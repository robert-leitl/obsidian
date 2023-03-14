import * as THREE from 'three';
import { OrbitControls } from '../libs/OrbitControls';
import testVert from './shader/test.vert.glsl';
import testFrag from './shader/test.frag.glsl';
import quadVert from './shader/quad.vert.glsl';
import bloomCompositeFrag from './shader/bloom-composite.frag.glsl';
import bloomBlurFrag from './shader/bloom-blur.frag.glsl';
import { resizeRendererToDisplaySize } from '../libs/three-utils';
import { BufferAttribute, BufferGeometry, Euler, Float32BufferAttribute, Mesh, Object3D, TextureLoader, Vector2, Vector3, WebGLRenderTarget } from 'three';

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

const PARTICLE_COUNT = 10000;
const dummy = new THREE.Object3D();

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
var _isDev, _pane, camera, scene, renderer, controls, mesh, hdrRT, quadMesh, lensDirtTexture;

function init(canvas, onInit = null, isDev = false, pane = null) {
    _isDev = isDev;
    _pane = pane;

    camera = new THREE.PerspectiveCamera( 90, window.innerWidth / window.innerHeight, 0.01, 10 );
    camera.position.z = 1;

    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer( { canvas, antialias: true } );
    renderer.setClearAlpha(1);
    document.body.appendChild( renderer.domElement );

    const lensDirtLoader = new TextureLoader();

    lensDirtLoader.load(new URL(`../assets/lens-dirt-00.jpg`, import.meta.url), (tex) => {
        lensDirtTexture = tex;
        lensDirtTexture.wrapS = THREE.ClampToEdgeWrapping;
        lensDirtTexture.wrapT = THREE.ClampToEdgeWrapping;
        lensDirtTexture.needsUpdate = true;

        hdrRT = new THREE.WebGLRenderTarget(renderer.domElement.clientWidth, renderer.domElement.clientHeight, {
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            generateMipmaps: false,
            depthBuffer: true,
            magFilter: THREE.LinearFilter,
            minFilter: THREE.LinearFilter
        });
    
        initBloom();
        initParticles();

        /*const material = new THREE.ShaderMaterial( {
            uniforms: {
                uTime: { value: 1.0 },
                uResolution: { value: new THREE.Vector2() }
            },
            vertexShader: testVert,
            fragmentShader: testFrag,
            glslVersion: THREE.GLSL3,
            side: THREE.DoubleSide,
            depthTest: true,
        });
        mesh = new THREE.Mesh( new THREE.TorusGeometry(0.4, 0.2), material, PARTICLE_COUNT );
        scene.add( mesh );*/
    
        controls = new OrbitControls( camera, renderer.domElement );
        controls.update();
    
        if (onInit) onInit(this);
        
        resize();
    });
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
            uResolution: { value: new Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight) }
        },
        vertexShader: quadVert,
        fragmentShader: bloomCompositeFrag,
        glslVersion: THREE.GLSL3,
    });
}

function initParticles() {
    const particleGeometry = new THREE.BufferGeometry();
    const particleRadius = 0.03;
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
        uniforms: {
            uTime: { value: 1.0 },
		    uResolution: { value: new THREE.Vector2() }
        },
        vertexShader: testVert,
        fragmentShader: testFrag,
        glslVersion: THREE.GLSL3,
        side: THREE.DoubleSide,
        //blending: THREE.AdditiveBlending,
        depthTest: true
    });
    mesh = new THREE.InstancedMesh( particleGeometry, material, PARTICLE_COUNT );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.onBeforeRender = () => {
        mesh.material.uniforms.uTime.value = time;
    }
    scene.add( mesh );
    for(let i=0; i<mesh.count; ++i) {
        mesh.getMatrixAt(i, dummy.matrix);
        dummy.position.x = Math.random() * .4;
        dummy.position.applyEuler(new Euler(
            Math.random() * 2 * Math.PI,
            Math.random() * 2 * Math.PI,
            Math.random() * 2 * Math.PI
        ));
        dummy.quaternion.random();
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
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
    controls.update();

    /*for(let i=0; i<mesh.count; ++i) {
        mesh.getMatrixAt(i, dummy.matrix);
        mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;*/
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