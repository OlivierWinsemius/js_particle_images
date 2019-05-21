/*
TODO(Olivier):
	Minimize globals
	Propper error handling
	Async loading of image data
	Move vertices on gpu side
*/

"use strict";

let vertices = new Array();
let velocities = new Array();
let targetVertices = new Array();
const canvasWidth = document.body.clientWidth;
const canvasHeight = document.body.clientHeight;
const canvas = document.getElementById('fancy-canvas');
canvas.width = canvasWidth;
canvas.height = canvasHeight;
const webgl = new webGL(canvas);

webgl.init()
	.then(response => start());

const start = (function(){
	
	const img = new Image();
	const GRIDSIZE = 2;

	const mousePos = new Float32Array(2);
	const canvasRatio = canvasWidth / canvasHeight;
	
	// Everything that happens when an the image updates
	const imageEvents = (function(){
		img.addEventListener("load", onImageLoaded, false);
		const loadImage = function(e){
			const name = img.src.split("/").splice(-1)[0]
			if(name === "jimi.jpg"){
				img.src = "img/logo.png";
			}else{
				img.src = "img/jimi.jpg";
			}
		};
		loadImage();

		// Reads image, calculates where vertices should appear and updates vertices array
		// TODO(Olivier): Break up into pieces and make asynchronous
		function onImageLoaded(){
			const img_canvas = document.createElement("canvas");
			img_canvas.height = img.height;
			img_canvas.width = img.width;
			const img_ratio = img.width / img.height;
			
			//draw image on invisible canvas, and retreive pixeldata (rgba / pixel)
			const img_ctx = img_canvas.getContext("2d"); 
			img_ctx.drawImage(img, 0, 0, img.width, img.height);
			const pixeldata = img_ctx.getImageData(0,0, img.width, img.height).data;
	
			//break down pixeldata in multidimensional array (rows & columns)
			const pixels = new Array();
			for(let row = 0; row < img.height - GRIDSIZE; row += GRIDSIZE){
				pixels.push(new Uint8Array(img.width / GRIDSIZE));
				for(let col = 0; col < img.width * 4; col += 4 * GRIDSIZE){
					//save each pixel in grayscale
					pixels[row / GRIDSIZE][col / (4 * GRIDSIZE)] = pixeldata[row * img.width * 4 + col];
				}
			}
	
			// NOTE(Olivier): This entire thing will be rewritten
			let currentParticle = 0;
			const particles = new Array();
			targetVertices = new Array();
			velocities = new Array();
			for(let i = 0; i < pixels.length; i ++){
				for(let j = 0; j < pixels[0].length; j ++){
					const pixel = pixels[i][j];
					if(pixel > 100){
						const k = (j + i * pixels.length) * 3;
						let x = j * GRIDSIZE;
						let y = -i * GRIDSIZE + img.height;
	
						if(img_ratio < canvasRatio){
							y = map(y, 0, img.height, -1, 1);
							x = map(x, 0, img.width, -1*img_ratio, 1*img_ratio);
						}else{
							y = map(y, 0, img.height, -canvasRatio/img_ratio, canvasRatio/img_ratio);
							x = map(x, 0, img.width, -canvasRatio, canvasRatio);
						}
						
						const dist 	= Math.sqrt(Math.pow(canvasRatio, 2) + 1);
						const r 		= Math.random() * Math.PI * 2;
	
						if(vertices.length < currentParticle) particles.push(Math.cos(r)*dist, Math.sin(r)*dist, 1.83);
						else particles.push(vertices[currentParticle], vertices[currentParticle+1], vertices[currentParticle+2]);
						
						targetVertices.push(x, y, 1.83);
						velocities.push((Math.random()*2 - 1)/10, (Math.random()*2 - 1)/10, (Math.random()*2 - 1)/10);
	
						currentParticle += 3;
					}
				}
			}
	
			vertices = new Float32Array (particles);
			targetVertices = new Float32Array (targetVertices);
			velocities = new Float32Array (velocities);
		}
		return { loadImage };
	})();
	
	// Tracking mouse and clickevents
	const windowEvents = (function() {
		window.addEventListener("mousemove", function(e){
			mousePos[0] = map(e.clientX, 0, canvasWidth, -canvasRatio, canvasRatio);
			mousePos[1] = map(e.clientY, 0, canvasHeight, 1, -1);
		});
		
		window.addEventListener("click", imageEvents.loadImage);
	})()

	function tick(){
		requestAnimationFrame(tick);
		animate();
		webgl.draw();
	}
	tick();

	// Move vertices in the vertexbuffer to their target 
	function animate(){
		const accel = 1;
		const friction = 1;
		const pushRad = 0.5;
		const pushForce = 1;

		for(let i=0; i<vertices.length; i+=3){
			// getting all the variables
			let x = vertices[i];
			let y = vertices[i+1];
			let z = vertices[i+2];

			let vx = velocities[i];
			let vy = velocities[i+1];
			let vz = velocities[i+2];

			const tx = targetVertices[i];
			const ty = targetVertices[i+1];
			const tz = 1.83;

			const mx = mousePos[0];
			const my = mousePos[1];
			const mz = 2;

			const mouseDist = Math.sqrt(Math.pow(x - mx, 2) + Math.pow(y - my, 2) + Math.pow(z - 1.83, 2));
			const targetDist = Math.sqrt(Math.pow(x - tx, 2) + Math.pow(y - ty, 2) + Math.pow(z - tz, 2), 100);
			
			// calculate the new velocity
			vx -= (x - tx) * (targetDist * accel)/50;
			vy -= (y - ty) * (targetDist * accel)/50;
			vz -= (z - tz) * (targetDist * accel)/100;

			if(mouseDist < pushRad){
				const force = (pushRad - mouseDist) * pushForce;
				vx += (x - mx) / mouseDist * force * 0.1;
				vy += (y - my) / mouseDist * force * 0.1;
				vz += (z - mz) / mouseDist * force * 0.1;
			}
		
			vx *= 1 - friction/10;
			vy *= 1 - friction/10;
			vz *= 1 - friction/5;

			// update the position
			x += vx;
			y += vy;
			z += vz;

			velocities[i+0]	= vx;
			velocities[i+1] = vy;
			velocities[i+2] = vz;

			vertices[i+0] 	= x;
			vertices[i+1] 	= y;
			vertices[i+2] 	= z;
		}
	};
})

function map(x, in_min, in_max, out_min, out_max){
	return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}