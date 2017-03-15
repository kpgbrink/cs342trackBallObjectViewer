/*
 * trackball -- view 3d objects
 *
 * Created for CS352, Calvin College Computer Science
 *
 * Harry Planting
 *
 * Updated by: Kristofer Brink
 */

var vertices;			// array of object vertices
var faces;			// array of object faces (with colors)
var modelMat, oldModelMat;	// current, old modelview matrix
var projectionMat;
var trackball = {
  screenWidth:  450,
  screenHeight: 342,
  radius:       150,
};

$(document).ready(function () { trackball.init(); });

/*
 * initialize: get context, bind events, set screen transform, load object
 */
trackball.init = function () {  
  $('#messages').html("Initializing<br>");
  trackball.canvas  = $('#canvas1')[0];
  trackball.cx = trackball.canvas.getContext('2d');
  trackball.cx.strokeStyle = 'rgb(250,0,0)';
  trackball.scale = 1;
  trackball.rotate1 = 0;
  trackball.rotate2 = 0;
  $('#zoomSlider').bind("change",trackball.zoom);
  $('#perspectiveSlider').bind("change",trackball.perspective);
  $('#object1').bind("change",trackball.load);
  $('#resetButton').bind("click",trackball.init);
    
  // set check boxes up
  $('#strokeCheckbox').bind("change", function () {trackball.stroke = this.checked;}).trigger('change');
  $('#fillCheckbox').bind("change", function () {trackball.fill = this.checked;}).trigger('change');
  $('#cullCheckbox').bind("change", function () {trackball.cullBack = this.checked;}).trigger('change');
  $('#cullFrontCheckbox').bind("change", function () {trackball.cullFront = this.checked;}).trigger('change');
  $('#sortCheckbox').bind("change", function () {trackball.HSR = this.checked;}).trigger('change');
  $('input[type], select').bind("change",trackball.display);
  
    // set world coords to (-1,-1) to (1,1) or so
  trackball.cx.setTransform(trackball.radius, 0, 0, -trackball.radius, 
        trackball.screenWidth/2, trackball.screenHeight/2 ); 
  trackball.load();
}

trackball.initTimer = function () {
  function reSetTimeout() {
    trackball.display();
    setTimeout(reSetTimeout, 200);
  }
  reSetTimeout();
  trackball.initTimer = () => {};
};

/*
 * Get selected JSON object file
 */
trackball.load = function() {
  var objectURL = $('#object1').val();
  log("Loading " + $('#object1').val());

  $.getJSON(objectURL, function(data) { 
    log("JSON file received");
    trackball.loadObject(data); 
    
    trackball.display();
      
    trackball.initTimer();
  }); 
}

/*
 * load object. Scale it to (roughly) fit in sphere centered on origin, with radius 1.
 * result stored in global arrays for simplicity:
 *   vertices[i] -- array of sylvester vectors
 *   faces[i] -- array of polygons to display
 *   faces[i].indices[j] -- array of vertex indices of faces
 *   faces[i].Kd[j] -- array of three diffuse color values for face, r, g, and b
 */
trackball.loadObject = function(obj) {
  $('#messages').html("In loadObject<br>");
  vertices = new Array(); 

  // find min and max coordinate values;
  var mins = new Array(), maxes = new Array();
  for (var k=0; k<3; k++) {
    maxes[k]=-1e300, mins[k]=1e300;
    for (var i=0+k; i<obj.vertexPositions.length; i+=3) {
      if (maxes[k] < obj.vertexPositions[i]) maxes[k] = obj.vertexPositions[i];
      if (mins[k] > obj.vertexPositions[i]) mins[k] = obj.vertexPositions[i];
    }
  }

  // normalize coordinates (center on origin, radius 1)]
  var dx = (mins[0] + maxes[0])/2;
  var dy = (mins[1] + maxes[1])/2;
  var dz = (mins[2] + maxes[2])/2;
  var scaleFactor = Math.max(maxes[0]-mins[0], maxes[1]-mins[1], maxes[2]-mins[2]) * .85;
  for (var i=0; i<obj.vertexPositions.length; i+=3) {
    obj.vertexPositions[i] =   (obj.vertexPositions[i] - dx) / scaleFactor;
    obj.vertexPositions[i+1] = (obj.vertexPositions[i+1] - dy) / scaleFactor;
    obj.vertexPositions[i+2] = (obj.vertexPositions[i+2] - dz) / scaleFactor;
  }
  log("Read " + i/3 + " vertices");

  // make vertex positions into vertex array of sylvester vectors 
  // $V([]) is a sylvester function for creating a vector -- see sylvester docs
  for (var i=0; i<obj.vertexPositions.length/3; i++) {
    vertices[i] = $V([obj.vertexPositions[3*i], obj.vertexPositions[3*i+1],
        obj.vertexPositions[3*i+2], 1]);
    if (i<3) log("&nbsp;vertex " + i + ": " + trackball.showVector(vertices[i])); 
    if (i==3) log("&nbsp;...");
  }

  // make the faces array, with indices and Kd arrays as properties
  var f=0;
  faces = new Array();
  for (var g=0; g<obj.groups.length; g++) {
    for (i=0; i<obj.groups[g].faces.length; i++) {
      faces[f] = {};
      faces[f].indices = obj.groups[g].faces[i];
      faces[f].Kd = obj.groups[g].Kd;
    if (f<3) log("&nbsp;face " + f + ": " + faces[f].indices); 
    if (f==3) log("&nbsp;...");
    f++;
    }
  }
}  


/*
 * Homogeneous 3D rotation
 */ 
trackball.Rotate4 = function(theta,n) {
    var m1 = Matrix.Rotation(theta,n);
    return Matrix.create([ 
        [m1.e(1,1), m1.e(1,2), m1.e(1,3), 0],
        [m1.e(2,1), m1.e(2,2), m1.e(2,3), 0],
        [m1.e(3,1), m1.e(3,2), m1.e(3,3), 0],
        [0, 0, 0, 1]]);
}

// scale matrix
trackball.Scale4 = function() {
    let scale = trackball.scale;
    return Matrix.Diagonal([scale, scale, scale, 0]);
}
    
trackball.display = function() {
  trackball.cx.lineWidth = 0.003;
  trackball.cx.clearRect(-2,-2,4,4);
  trackball.cx.beginPath();
  trackball.cx.arc(0,0,1,6.283,0,true);
  trackball.cx.stroke();
  trackball.cx.lineWidth = 0.006;
  trackball.rotate1 = (trackball.rotate1 + .1) % (Math.PI * 2);
  trackball.rotate2 = (trackball.rotate1 + .09) % (Math.PI * 2);
  trackball.drawObject();
}

trackball.zoom = function(ev) {
  $('#zoom').text(($('#zoomSlider').val()/100).toFixed(2));
  trackball.scale = $('#zoomSlider').val() / 100;
}

trackball.perspective = function(ev) {
  $('#perspective').text(($('#perspectiveSlider').val()/10).toFixed(2));
  var persp = $('#perspectiveSlider').val() / 10;
}

trackball.showVector = function(v) {
  return "[" + v.e(1).toFixed(2) + ", " + v.e(2).toFixed(2) + ", " + v.e(3).toFixed(2) + "]";
}

log = function(s) {
   if ($('#debugCheckbox').attr('checked'))
     $('#messages').append(s + "<br>");
}

trackball.drawObject = function () {
    //console.log('draw object');
    //console.log('faces', faces);
    //console.log('vertices', vertices);
    
    let rotateMatrix1 = trackball.Rotate4(trackball.rotate1, Vector.create([0,1,0]));
    let rotateMatrix2 = trackball.Rotate4(trackball.rotate2, Vector.create([1,0,0]));
    let scaleMatrix = trackball.Scale4();
    const cameraVector = Vector.create([0,0,1]);
    //console.log('camera', cameraVector);
    
    const Vector4dTo3d = v => {
        return Vector.create(v.elements.slice(0,3));  
    };
    
    const applyTranformations = vi => {
        let vec = Vector.create([
           vertices[vi].elements[0],
           vertices[vi].elements[1],
           vertices[vi].elements[2],
           1
        ]);

        return rotateMatrix1.multiply(rotateMatrix2).multiply(scaleMatrix).multiply(vec);
    };
    
    
    let newFaces = faces.map((f) => ({Kd:f.Kd, vertices: f.indices.map(applyTranformations)}));
    
    const getMidPoint = vertices => {
        let zAdded = 0;
        for (vertex of vertices) {
            zAdded += vertex.elements[2];
        }
        return zAdded / vertices.length;
    };
    
    if (trackball.HSR) {
        newFaces.sort((a, b) => {
            return getMidPoint(a.vertices) - getMidPoint(b.vertices);
        });
    }
    
    // draw the object
    for (face of newFaces) {
        //console.log('face', face);
        trackball.cx.fillStyle = `rgb(${255*face.Kd[0]|0}, ${255*face.Kd[1]|0}, ${255*face.Kd[2]|0})`;
        //console.log('fillstyle',trackball.cx.fillStyle);
        trackball.cx.beginPath();
        
        
        
        // culling
        let newNormal = Vector4dTo3d(face.vertices[1].subtract(face.vertices[0])).cross(Vector4dTo3d(face.vertices[2].subtract(face.vertices[0]))); 
        let cullNum = cameraVector.dot(newNormal);
        
        //console.log(cullNum);
        if (cullNum > 0 && trackball.cullBack) {
            continue;
        }
        
        if (cullNum <= 0 && trackball.cullFront) {
            continue;
        }
        
        trackball.cx.moveTo(face.vertices[0].elements[0], face.vertices[0].elements[1]);
        
        for (vertex of face.vertices) {
            //console.log('indice', indice);
            //console.log('move to', vertices[indice].elements);
            
            // make matrix
            
            trackball.cx.lineTo(vertex.elements[0], vertex.elements[1]);
            //console.log('newMatrix',newMatrix);
            
        }
        
        //console.log('fill', trackball.fill, 'stroke', trackball.stroke);
        if (trackball.stroke) trackball.cx.stroke();
        if (trackball.fill) trackball.cx.fill();
    }
}




