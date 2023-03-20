import * as THREE from 'three';
import { OrbitControls } from '../libs/OrbitControls';
import crystalVert from './shader/crystal.vert.glsl';
import crystalFrag from './shader/crystal.frag.glsl';
import orbVert from './shader/orb.vert.glsl';
import orbFrag from './shader/orb.frag.glsl';
import quadVert from './shader/quad.vert.glsl';
import bloomCompositeFrag from './shader/bloom-composite.frag.glsl';
import bloomBlurFrag from './shader/bloom-blur.frag.glsl';
import { resizeRendererToDisplaySize } from '../libs/three-utils';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, LoadingManager, Matrix4, Mesh, MeshBasicMaterial, Object3D, Plane, PointLight, Quaternion, RectAreaLight, Scene, ShaderChunk, Sphere, SphereGeometry, sRGBEncoding, TextureLoader, TorusGeometry, Vector2, Vector3, WebGLRenderTarget } from 'three';
import { iphone, isMobileDevice } from './platform';
import { SecondOrderSystemValue } from './second-order-value';
import { DeviceOrientationControls } from './device-orientation-controls';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Credts:
// - https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/UnrealBloomPass.js


// the target duration of one frame in milliseconds
const TARGET_FRAME_DURATION = 16;

// total time
var time = 0; 

// duration betweent the previous and the current animation frame
var deltaTime = 0; 

// total framecount according to the target frame duration
var frames = 0; 

// relative frames according to the target frame duration (1 = 60 fps)
// gets smaller with higher framerates --> use to adapt animation timing
var deltaFrames = 0;

const PARTICLE_COUNT = 300;
const dummy = new THREE.Object3D();
const itemTransforms = [];

const settings = {
}


const bloomRenderTargetsHorizontal = [];
const bloomRenderTargetsVertical = [];
const bloomKernelSizes = [ 3, 5, 7, 9, 11 ];
//const bloomKernelSizes = [ 8, 10, 14, 18, 22 ];
const bloomTexSizes = [];
const bloomSizeFactor = 0.3;
const BLOOM_MIP_COUNT = bloomKernelSizes.length;
let bloomMaterial, bloomCompositeMaterial;

// module variables
var _isDev, 
    _pane, 
    _isInitialized = false,
    camera, 
    scene, 
    renderer, 
    controls, 
    mesh, 
    hdrRT, 
    quadMesh, 
    lensDirtTexture,
    envTexture,
    contractOffset = 0,
    genEnvTexture,
    pmremDefines,
    contract = new SecondOrderSystemValue(2, 0.5, 1, 0),
    crystalMesh;

function init(canvas, onInit = null, isDev = false, pane = null) {
    _isDev = isDev;
    _pane = pane;

    const manager = new LoadingManager();

    const lensDirtLoader = new TextureLoader(manager);
    lensDirtLoader.load(new URL(`../assets/lens-dirt-00.jpg`, import.meta.url), (tex) => {
        lensDirtTexture = tex;
        lensDirtTexture.wrapS = THREE.ClampToEdgeWrapping;
        lensDirtTexture.wrapT = THREE.ClampToEdgeWrapping;
        lensDirtTexture.needsUpdate = true;
    });

    const objLoader = new GLTFLoader(manager);
    objLoader.load((new URL('../assets/crystal.glb', import.meta.url)).toString(), (gltf) => {
        crystalMesh = (gltf.scene.children[0])
    });

    manager.onLoad = () => {
        camera = new THREE.PerspectiveCamera( 90, window.innerWidth / window.innerHeight, 0.01, 10 );
        camera.position.z = 1;
        scene = new THREE.Scene();
        renderer = new THREE.WebGLRenderer( { canvas, antialias: false } );
        document.body.appendChild( renderer.domElement );

        hdrRT = new THREE.WebGLRenderTarget(renderer.domElement.clientWidth, renderer.domElement.clientHeight, {
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            generateMipmaps: false,
            depthBuffer: true,
            magFilter: THREE.LinearFilter,
            minFilter: THREE.LinearFilter
        });
        
        initBloom();
        initEnvironment();
        initParticles();
    
        if (!isMobileDevice && !iphone()) {
            controls = new OrbitControls( camera, renderer.domElement );
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.3;
            controls.enableDamping = true;
            controls.enableZoom = false;
            controls.enablePan = false;
            controls.update();
        } else {
            controls = new DeviceOrientationControls(scene);
        }

        renderer.domElement.addEventListener('pointerdown', () => contractOffset = 1);
        renderer.domElement.addEventListener('pointerup', () => contractOffset = 0);
        renderer.domElement.addEventListener('pointerleave', () => contractOffset = 0);
    
        _isInitialized = true;
        if (onInit) onInit(this);
        
        resize();
    }
}

function initEnvironment() {
    const envScene = new Scene();

    const material = new MeshBasicMaterial();
	material.color.setScalar( 50 );
    const geometry1 = new BoxGeometry(10, 10, 0.1);
	geometry1.deleteAttribute( 'uv' );
    const light1 = new Mesh( geometry1, material );
    light1.position.z = 5;
    envScene.add( light1 );
    
    const material2 = new MeshBasicMaterial();
    material2.color.setRGB(120, 110, 150);
    const geometry2 = new TorusGeometry(50, 0.4);
	geometry1.deleteAttribute( 'uv' );
    const light2 = new Mesh( geometry2, material2 );
    light2.rotation.x = Math.PI / 2;
    envScene.add( light2 );

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const rt = pmremGenerator.fromScene(envScene);
    genEnvTexture = rt.texture;
    pmremDefines = (pmremGenerator._blurMaterial.defines);
    pmremGenerator.dispose();

    //scene.background = genEnvTexture;
}

function initBloom() {
    const size = new Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight);

    for(let i=0; i<BLOOM_MIP_COUNT; ++i) {
        const renderTargetHorizonal = new WebGLRenderTarget( size.x, size.y, { 
            type: THREE.FloatType, 
            generateMipmaps: false 
        } );
        renderTargetHorizonal.texture.name = 'BloomPass.h' + i;
        renderTargetHorizonal.texture.generateMipmaps = false;
        bloomRenderTargetsHorizontal.push( renderTargetHorizonal );

        const renderTargetVertical = new WebGLRenderTarget( size.x, size.y, { 
            type: THREE.FloatType, 
            generateMipmaps: false 
        } );
        renderTargetVertical.texture.name = 'BloomPass.v' + i;
        renderTargetVertical.texture.generateMipmaps = false;
        bloomRenderTargetsVertical.push( renderTargetVertical );

        bloomTexSizes[i] = size.clone();

        size.multiplyScalar(bloomSizeFactor);
    }

    bloomMaterial = new THREE.ShaderMaterial( {
        uniforms: {
            uKernelSize: { value: 1 },
            uColorTexture: { value: null },
            uDirection: { value: null },
            uTexSize: { value: null }
        },
        vertexShader: quadVert,
        fragmentShader: bloomBlurFrag,
        glslVersion: THREE.GLSL3,
    });
    const quadGeo = new BufferGeometry();
    quadGeo.setAttribute( 'position', new Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );
    quadGeo.setAttribute( 'uv', new Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );
    quadMesh = new Mesh(quadGeo, bloomMaterial);

    bloomCompositeMaterial = new THREE.ShaderMaterial( {
        uniforms: {
            uColorTexture: { value: hdrRT.texture },
            uBlurTexture1: { value: bloomRenderTargetsVertical[0].texture },
            uBlurTexture2: { value: bloomRenderTargetsVertical[1].texture },
            uBlurTexture3: { value: bloomRenderTargetsVertical[2].texture },
            uBlurTexture4: { value: bloomRenderTargetsVertical[3].texture },
            uBlurTexture5: { value: bloomRenderTargetsVertical[4].texture },
            uLensDirtTexture: { value: lensDirtTexture },
            uMipCount: { value: BLOOM_MIP_COUNT},
            uResolution: { value: new Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight) },
        },
        vertexShader: quadVert,
        fragmentShader: bloomCompositeFrag,
        glslVersion: THREE.GLSL3,
    });
}

function initParticles() {
    const particleGeometry = new THREE.BufferGeometry();
    const particleRadius = 0.025;
    const particleVertices = new Float32Array([
        particleRadius, 0, 0,
        particleRadius * Math.cos((Math.PI * 2) / 3), particleRadius * Math.sin((Math.PI * 2) / 3), 0,
        particleRadius * Math.cos((Math.PI * 4) / 3), particleRadius * Math.sin((Math.PI * 4) / 3), 0,
    ]);
    const particleNormals = new Float32Array([
        0, 0, 1,
        0, 0, 1,
        0, 0, 1
    ]);
    const particleTexcoords = new Float32Array([
        1, 0.5,
        0, 0,
        0, 1
    ]);
    particleGeometry.setAttribute('position', new BufferAttribute(particleVertices, 3));
    particleGeometry.setAttribute('normal', new BufferAttribute(particleNormals, 3));
    particleGeometry.setAttribute('uv', new BufferAttribute(particleTexcoords, 2));
    const material = new THREE.ShaderMaterial( {
        defines: {
            ...pmremDefines
            /*CUBEUV_MAX_MIP: "8.0",
            CUBEUV_TEXEL_HEIGHT: 0.0009765625,
            CUBEUV_TEXEL_WIDTH: 0.0013020833333333333,
            n: 20*/
        },
        uniforms: {
            uTime: { value: 1.0 },
		    uResolution: { value: new THREE.Vector2() },
            uEnvTexture: { value: genEnvTexture },
            uDirtTexture: { value: lensDirtTexture }
        },
        vertexShader: crystalVert,
        fragmentShader: `
            #define ENVMAP_TYPE_CUBE_UV 1
            ${ShaderChunk.cube_uv_reflection_fragment}
            ${crystalFrag}
        `,
        glslVersion: THREE.GLSL3,
        depthTest: true
    });
    //mesh = new THREE.InstancedMesh( new CylinderGeometry(particleRadius, particleRadius, .1, 5, 1), material, PARTICLE_COUNT );
    mesh = new THREE.InstancedMesh(crystalMesh.geometry, material, PARTICLE_COUNT );
    const s = 0.04;
    mesh.geometry.applyMatrix4((new Matrix4()).makeScale(s, s, s));
    mesh.geometry.applyMatrix4((new Matrix4()).makeRotationZ(Math.PI / 2));
    mesh.geometry.applyMatrix4((new Matrix4()).makeTranslation(0.05, 0, 0));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.onBeforeRender = () => {
        mesh.material.uniforms.uTime.value = time;
    }
    scene.add( mesh );
    const sphereRadius = 0.3;
    for(let i=0; i<mesh.count; ++i) {
        const radiusScale = Math.random() * 2. + 1;
        itemTransforms[i] = {
            radiusOffset: 0,
            phase: Math.random() * 2 * Math.PI,
            velocity: Math.random(),
            matrix: new Matrix4(),
            position: new Vector3(sphereRadius + Math.random() * .4, 0, 0),
            scale: new Vector3((Math.random() * 3 + 1) / radiusScale, radiusScale, radiusScale),
            rotation: (new Quaternion()).random()
        };

        const transform = itemTransforms[i];
        const matrix = transform.matrix.identity();
        matrix.setPosition(transform.position);
        const scaleMat = (new Matrix4()).makeScale(transform.scale.x, transform.scale.y, transform.scale.z);
        const rotMat = (new Matrix4()).makeRotationFromQuaternion(transform.rotation);
        matrix.premultiply(rotMat);
        matrix.multiply(scaleMat);
        mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const sphere = new Mesh(
        new SphereGeometry(0.2),
        new THREE.ShaderMaterial( {
            uniforms: {
                uTime: { value: 1.0 },
                uResolution: { value: new THREE.Vector2() },
            },
            vertexShader: orbVert,
            fragmentShader: orbFrag,
            glslVersion: THREE.GLSL3,
            depthTest: true
        })
    )
    scene.add(sphere);
}

function run(t = 0) {
    deltaTime = Math.min(TARGET_FRAME_DURATION, t - time);
    time = t;
    deltaFrames = deltaTime / TARGET_FRAME_DURATION;
    frames += deltaFrames;

    animate();
    render();

    requestAnimationFrame((t) => run(t));
}

function resize() {
    if (!_isInitialized) return;
    
    if (resizeRendererToDisplaySize(renderer)) {
        const size = new Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight);
        camera.aspect = size.x / size.y;
        camera.updateProjectionMatrix();

        if (hdrRT) {
            hdrRT.setSize(size.x, size.y);
            bloomCompositeMaterial.uniforms.uResolution.value = size.clone();

            for(let i=0; i<BLOOM_MIP_COUNT; ++i) {
                bloomRenderTargetsHorizontal[i].setSize( size.x, size.y );
                bloomRenderTargetsVertical[i].setSize( size.x, size.y );
                bloomTexSizes[i] = size.clone();
        
                size.multiplyScalar(bloomSizeFactor);
            }
        }
    }
}

function animate() {
    if (controls) controls.update();

    contract.update(deltaTime * 0.001 + 0.0001, contractOffset);

    for(let i=0; i<mesh.count; ++i) {
        const transform = itemTransforms[i];
        const matrix = transform.matrix.identity();
        const radiusOffset = (Math.sin(time * 0.001 * transform.velocity + transform.phase) * 0.5 + 0.5) * 0.05;
        let x = transform.position.x + radiusOffset;
        x *= (1. - contract.value) + contract.value * 0.6;
        const posMat = matrix.makeTranslation(x, transform.position.y, transform.position.z);
        const scaleMat = (new Matrix4()).makeScale(transform.scale.x, transform.scale.y, transform.scale.z);
        const rotMat = (new Matrix4()).makeRotationFromQuaternion(transform.rotation);
        matrix.premultiply(rotMat);
        matrix.multiply(scaleMat);
        mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
}

function render() {
    renderer.setRenderTarget(hdrRT);
    renderer.clear();
    renderer.render( scene, camera );

    let inputRenderTarget = hdrRT.texture;
    quadMesh.material = bloomMaterial;
    for ( let i = 0; i < BLOOM_MIP_COUNT; i ++ ) {
        quadMesh.material.uniforms.uColorTexture.value = inputRenderTarget;
        quadMesh.material.uniforms.uDirection.value = new Vector2(1., 0);
        quadMesh.material.uniforms.uKernelSize.value = bloomKernelSizes[i];
        quadMesh.material.uniforms.uTexSize.value = bloomTexSizes[i];
        renderer.setRenderTarget( bloomRenderTargetsHorizontal[ i ] );
        renderer.clear();
        renderer.render( quadMesh, camera );

        quadMesh.material.uniforms.uColorTexture.value = bloomRenderTargetsHorizontal[ i ].texture;
        quadMesh.material.uniforms.uDirection.value = new Vector2(0, 1.);
        renderer.setRenderTarget( bloomRenderTargetsVertical[ i ] );
        renderer.clear();
        renderer.render( quadMesh, camera );

        inputRenderTarget = bloomRenderTargetsVertical[ i ].texture;
    }
    
    renderer.setRenderTarget(null);
    quadMesh.material = bloomCompositeMaterial;
    renderer.render(quadMesh, camera);
}

export default {
    init,
    run,
    resize
}