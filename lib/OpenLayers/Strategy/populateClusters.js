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
    return prefix + OpenLayers.Util.lastSeqID;        
};

importScripts(
    'OpenLayers/lib/OpenLayers/BaseTypes/Class.js',
    'OpenLayers/lib/OpenLayers/Strategy.js',
    'OpenLayers/lib/OpenLayers/Strategy/QuadTree.js',
    'OpenLayers/lib/OpenLayers/BaseTypes/Bounds.js',
    'OpenLayers/lib/OpenLayers/BaseTypes/LonLat.js',
    'OpenLayers/lib/OpenLayers/Strategy/Cluster.js',
    'OpenLayers/lib/OpenLayers/Geometry.js',
    'OpenLayers/lib/OpenLayers/Geometry/Point.js',
    'OpenLayers/lib/OpenLayers/Feature.js',
    'OpenLayers/lib/OpenLayers/Feature/Vector.js');

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

self.addEventListener('message', function(e) {
    var Cluster = new OpenLayers.Strategy.Cluster(),
        d = e.data;

    d.features.forEach(function(f) {
        f.geometry.bounds.__proto__ = OpenLayers.Bounds.prototype;
        f.geometry.__proto__ = parseObjProto(f.geometry.id);
    });

    self.postMessage({ 
        clusters: Cluster.populateClusters(
            d.features, d.resolution, d.distance, d.extent) 
    });
    self.close();
}, false);
