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

const cameraVector = Vector.create([0,0,1]);
const lightVector = Vector.create([0,-1,0]);
var moving = false;

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
  trackball.perspective = 6;
  trackball.rotate = 0;
  $('#zoomSlider').bind("change",trackball.zoom);
  $('#perspectiveSlider').bind("change",trackball.perspectiveFunc);
  $('#object1').bind("change",trackball.load);
  //$('#resetButton').bind("click",trackball.init);
    
  modelMat = Matrix.I(4);
    
  // set check boxes up
  $('#strokeCheckbox').bind("change", function () {trackball.stroke = this.checked;}).trigger('change');
  $('#fillCheckbox').bind("change", function () {trackball.fill = this.checked;}).trigger('change');
  $('#cullCheckbox').bind("change", function () {trackball.cullBack = this.checked;}).trigger('change');
  $('#cullFrontCheckbox').bind("change", function () {trackball.cullFront = this.checked;}).trigger('change');
  $('#sortCheckbox').bind("change", function () {trackball.HSR = this.checked;}).trigger('change');
  $('#lightCheckbox').bind("change", function () {trackball.light = this.checked;}).trigger('change');
  $('#perspectiveCheckbox').bind("change", function () {trackball.perspectiveBool = this.checked;}).trigger('change');
  $('input[type], select').bind("change",trackball.display);
    
  // mouse
  $(trackball.canvas).bind("mousedown",trackball.mousedown);
  $(trackball.canvas).bind("mousemove",trackball.mousemove);
  $(trackball.canvas).bind("mouseup",trackball.mouseup);
  
    // set world coords to (-1,-1) to (1,1) or so
  trackball.cx.setTransform(trackball.radius, 0, 0, -trackball.radius, 
        trackball.screenWidth/2, trackball.screenHeight/2 ); 
  trackball.load();
}



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
trackball.scalePerspective4 = function() {
    let s = trackball.scale;
    let d = trackball.perspectiveBool?(-1/(trackball.perspective)):0;
    // console.log(d);
    return Matrix.create([
                         [s, 0, 0, 0],
                         [0, s, 0, 0],
                         [0, 0, s, 0],
                         [0, 0, d, 1] ]);
}
    
trackball.display = function() {
  trackball.cx.lineWidth = 0.003;
  trackball.cx.clearRect(-2,-2,4,4);
  trackball.cx.beginPath();
  trackball.cx.arc(0,0,1,6.283,0,true);
  trackball.cx.stroke();
  trackball.cx.lineWidth = 0.01;
  trackball.drawObject();
}

trackball.zoom = function(ev) {
  $('#zoom').text(($('#zoomSlider').val()/100).toFixed(2));
  trackball.scale = $('#zoomSlider').val() / 100;
}

trackball.perspectiveFunc = function(ev) {
  $('#perspective').text(($('#perspectiveSlider').val()/10).toFixed(2));
  trackball.perspective = $('#perspectiveSlider').val() / 10;
  //console.log(trackball.perspective);
}

trackball.showVector = function(v) {
  return "[" + v.e(1).toFixed(2) + ", " + v.e(2).toFixed(2) + ", " + v.e(3).toFixed(2) + "]";
}

log = function(s) {
   if ($('#debugCheckbox').attr('checked'))
     $('#messages').append(s + "<br>");
}

trackball.getPoint = function(ev) 
{
    //Get the x and y
    let x = (ev.pageX - trackball.screenWidth/2 - 240  )/trackball.radius;
    let y = -(ev.pageY - trackball.screenHeight/2 - 70 )/trackball.radius;

    let zSquared = 1 - x*x - y*y;
    let z;
    if (zSquared < 0 ) {
	   z = 0;
    }
    else {
       z = Math.sqrt( 1 - x*x - y*y )
    }
    return Vector.create([x,y,z]);
}


trackball.mousedown = function(ev) 
{
  // Store original point
  oldModelMat = modelMat.multiply(1);
  p1 = trackball.getPoint(ev);
  moving = true;
}

trackball.mousemove = function(ev) 
{
  if ( moving ) {
    // Get angles between different vectors
    let p2 = trackball.getPoint(ev);
    let n = p1.cross(p2); 
    let theta = p1.angleFrom(p2);
 
    // Rotate
    modelMat = oldModelMat.multiply(1);
    modelMat = trackball.Rotate4(theta, n).multiply(modelMat);
    trackball.display();
  }
}


trackball.mouseup = function(ev) 
{
  moving = false;
}


trackball.drawObject = function () {
    //console.log('draw object');
    //console.log('faces', faces);
    //console.log('vertices', vertices);
    if (!faces) {
        return;
    }
    
    let rotateMatrix1 = trackball.Rotate4(trackball.rotate, Vector.create([1,1,0]));
    let scaleMatrix = trackball.scalePerspective4();
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

        const v3 = modelMat.multiply(vec);
        //v3.elements[3] = 1;
        const v2 = scaleMatrix.multiply(v3);
        //return v2;
        let w = v2.elements[3];
        let vElem = v2.elements;
        return Vector.create([vElem[0]/w, vElem[1]/w, vElem[2]/w ]);
    };
    
    
    let newFaces = faces.map((f) => ({Kd:f.Kd, vertices: f.indices.map(applyTranformations)}));
    
    // HSR
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
        
        // culling
        let newNormal = Vector4dTo3d(face.vertices[1].subtract(face.vertices[0])).cross(Vector4dTo3d(face.vertices[2].subtract(face.vertices[0]))); 
        
        newNormal = newNormal.toUnitVector();
        
        //const cameraVector = Vector.create([0,0,1]);
        
        
        // Light
        if (trackball.light) {
            let lightNum = (lightVector.dot(newNormal) + 1.5)/2;
            // console.log('light num', lightNum);
            trackball.cx.fillStyle = `rgb(${255*(face.Kd[0]*lightNum)|0}, ${255*(face.Kd[1]*lightNum)|0}, ${255*(face.Kd[2]*lightNum)|0})`;
        } else {
            trackball.cx.fillStyle = `rgb(${255*face.Kd[0]|0}, ${255*face.Kd[1]|0}, ${255*face.Kd[2]|0})`;
        }
        
        trackball.cx.strokeStyle = trackball.cx.fillStyle;
        
        //console.log('fillstyle',trackball.cx.fillStyle);
        trackball.cx.beginPath();
        
        
        let cullNum = cameraVector.dot(newNormal);
        
        // Cull Back
        if (cullNum > 0 && trackball.cullBack) {
            continue;
        }
        
        // Cull Front
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




