import * as THREE from 'three';
import { OrbitControls } from '../libs/OrbitControls';
import testVert from './shader/test.vert.glsl';
import testFrag from './shader/test.frag.glsl';
import { resizeRendererToDisplaySize } from '../libs/three-utils';

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

const settings = {
}

// module variables
var _isDev, _pane, camera, scene, renderer, controls, mesh;

function init(canvas, onInit = null, isDev = false, pane = null) {
    _isDev = isDev;
    _pane = pane;

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 10 );
    camera.position.z = 1;

    scene = new THREE.Scene();

    const geometry = new THREE.PlaneGeometry();
    const material = new THREE.ShaderMaterial( {
        uniforms: {
            uTime: { value: 1.0 },
		    uResolution: { value: new THREE.Vector2() }
        },
        vertexShader: testVert,
        fragmentShader: testFrag,
        glslVersion: THREE.GLSL3
    });
    mesh = new THREE.Mesh( geometry, material );
    mesh.onBeforeRender = () => {
        mesh.material.uniforms.uTime.value = time;
    }
    scene.add( mesh );

    renderer = new THREE.WebGLRenderer( { canvas, antialias: true } );
    document.body.appendChild( renderer.domElement );

    controls = new OrbitControls( camera, renderer.domElement );
    controls.update();

    if (onInit) onInit(this);
    
    resize();
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
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    }
}

function animate() {
    controls.update();
}

function render() {
    renderer.render( scene, camera );
}

export default {
    init,
    run,
    resize
}