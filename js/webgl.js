"use strict";

const webGL = (function(canvas) {
    let shaderProgram;
    let gl = null;

    const init = function(){
        return new Promise((resolve, reject) => {
            try {
                gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
                gl.viewportWidth = canvasWidth;
                gl.viewportHeight = canvasHeight;
                gl.clearColor(0.0, 0.0, 0.0, 1.0);
                gl.enable(gl.DEPTH_TEST);
            }
            catch (e) {
                reject(e)
            }

            if(gl){
                initProgram().then(
                    success => {
                        Promise.all([
                            initBuffers(),
                            initMatrices(),
                        ])
                        .then(
                            success => resolve(),
                            error => reject(error)
                        );
                    },
                    error => reject(error)
                )
            }
        })
	};

    // create vertex-buffer
    // NOTE(Olivier): since we're making a point cloud, there's no need for an index-buffer
	function initBuffers(){
        return new Promise((resolve, reject) => {
            try{
                const triangleVertexPositionBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexPositionBuffer);
                // NOTE(Olivier): maybe fiddle with draw types
                gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW); 
                triangleVertexPositionBuffer.itemSize = 3;
                triangleVertexPositionBuffer.numItems = vertices.length / 3;
                resolve();
            }
            catch(e){
                reject(e);
            }
        })
    };
    
    function initProgram() {
        return new Promise((resolve, reject) => {
            shaderProgram = gl.createProgram();
            // Load all shader files (.vert for vertex, .frag for fragment shaders)
            loadShaders(['shaders/shader.vert', 'shaders/shader.frag'])
                .then(response => {
		            // Attach shaders to shaderprogram
                    gl.attachShader(shaderProgram, response[0]);
                    gl.attachShader(shaderProgram, response[1])
                    gl.linkProgram(shaderProgram);

                    if(!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)){
                        return reject("could not initialize shaders");
                    }

                    gl.useProgram(shaderProgram);

                    // Set the references to attributes in the vertex shader.
                    // Create vertex attribute prototype in shaderprogram,
                    // Pass this into enableVertexAttribArray
                    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
                    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

                    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, 'uPMatrix');
                    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, 'uMVMatrix');
                    resolve();
                }, 
                error => reject(error)
            )
        });
    }

	function initMatrices(){
        return new Promise((resolve, reject) => {
            gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
            gl.clear(gl.COLOR_BUFFER_BIT);
    
            // settings for view matrix
            const fieldOfView = 30.0;
            const aspectRatio = canvas.width / canvas.height;
            const nearPlane = 1.0;
            const farPlane = 10000.0;
            const top = nearPlane * Math.tan(fieldOfView * Math.PI / 360.0);
            const bottom = -top;
            const right = top * aspectRatio;
            const left = -right;
    
            const a = (right + left) / (right - left);
            const b = (top + bottom) / (top - bottom);
            const c = (farPlane + nearPlane) / (farPlane - nearPlane);
            const d = (2 * farPlane * nearPlane) / (farPlane - nearPlane);
            const x = (2 * nearPlane) / (right - left);
            const y = (2 * nearPlane) / (top - bottom);

            
            // vertexAttribPointer specifies memory layout of vertex-buffer
            // in this case floating-points in groups of 3
            const vertexPosAttribLocation = gl.getAttribLocation(shaderProgram, "aVertexPosition");
            gl.vertexAttribPointer(vertexPosAttribLocation, 3.0, gl.FLOAT, false, 0, 0);
    
            const modelViewMatrix = [
                x, 0, a, 0,
                0, y, b, 0,
                0, 0, c, d,
                0, 0, -1, 0
            ];
            
            const uModelViewMatrix = gl.getUniformLocation(shaderProgram, "uMVMatrix");
            gl.uniformMatrix4fv(uModelViewMatrix, false, new Float32Array(modelViewMatrix));
            
            // orthographic view
            const perspectiveMatrix = [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ];
            const uPerspectiveMatrix = gl.getUniformLocation(shaderProgram, "uPMatrix");
            gl.uniformMatrix4fv(uPerspectiveMatrix, false, new Float32Array(perspectiveMatrix));
    

            resolve();
        })
    }
    
    function loadShaders(urls) {
        return new Promise((resolve, reject) => {
            const numUrls = urls.length;
            const result = [];
            let numComplete = 0;
            for(let i = 0; i < numUrls; i++){
                loadShader(urls[i], i)
                    .then(
                        response => {
                            result[response.index] = response.shader;
                            numComplete++;
                            if(numComplete == numUrls)
                                resolve(result);
                        },
                        error => reject(errror)
                    )
            }
        })
    }

    function loadShader(url, index) {
        return new Promise((resolve, recect) => {
            fetch(url)
            .then(data => data.text())
            .then(result => {
                const shader = url.split('.').slice(-1)[0] == "vert" ?
                                gl.createShader(gl.VERTEX_SHADER) : // load vertex shader
                                gl.createShader(gl.FRAGMENT_SHADER);// load fragment shader
                
                // set shader source, and compile
                console.log( result)
                gl.shaderSource(shader, result);
                gl.compileShader(shader);
                resolve({index, shader});
            })
            .catch(e => reject(e));
        });
    }

    const draw = function(){
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.drawArrays(gl.POINTS, 0, vertices.length/3);
		gl.flush();
    }

    return { init, draw };
})