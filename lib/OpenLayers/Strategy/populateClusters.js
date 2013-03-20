OpenLayers = {};

OpenLayers.Util = OpenLayers.Util || {};

OpenLayers.Util.isArray = function(a) {
    return (Object.prototype.toString.call(a) === '[object Array]');
};

OpenLayers.Util.toFloat = function (number, precision) {
    if (precision == null) {
        precision = OpenLayers.Util.DEFAULT_PRECISION;
    }
    if (typeof number !== "number") {
        number = parseFloat(number);
    }
    return precision === 0 ? number :
                             parseFloat(number.toPrecision(precision));
};

OpenLayers.Util.lastSeqID = 0;


OpenLayers.Util.createUniqueID = function(prefix) {
    if (prefix == null) {
        prefix = "id_";
    } else {
        prefix = prefix.replace(OpenLayers.Util.dotless, "_");
    }
    OpenLayers.Util.lastSeqID += 1; 
    return prefix + OpenLayers.Util.lastSeqID + ':' + self.id;
};

importScripts(
    '../BaseTypes/Class.js',
    '../Strategy.js',
    'QuadTree.js',
    '../BaseTypes/Bounds.js',
    '../BaseTypes/LonLat.js',
    'Cluster.js',
    '../Geometry.js',
    '../Geometry/Point.js',
    '../Feature.js',
    '../Feature/Vector.js');

function parseObjProto(obj_id) {
    var re = /([^_]+)_/g,
        comps = [];
    function rec() {
        var match = re.exec(obj_id);
        if ( match ) {
            comps.push(match[1]);
            rec();
        }
    }
    rec();
    comps = comps.join('.');
    if ( comps )
        return eval(comps+'.prototype');
    else
        return null;
}

function cluster(d) {
    var Cluster = new OpenLayers.Strategy.Cluster();
    d.features.forEach(function(f) {
        f.geometry.bounds.__proto__ = OpenLayers.Bounds.prototype;
        f.geometry.__proto__ = parseObjProto(f.geometry.id);
    });

    self.postMessage({ 
        clusters: Cluster.populateClusters(
            d.features, d.resolution, d.distance, d.extent) 
    });
}

self.addEventListener('message', function(e) {
    var cmd = e.data.cmd;
    if ( cmd === "init" ) {
        self.id = e.data.id;
        if ( self.data )
            cluster(self.data);
    }
    else if ( cmd === "cluster" ) {
        if ( self.id )
            cluster(e.data);
        else
            self.data = e.data;
    }
}, false);
