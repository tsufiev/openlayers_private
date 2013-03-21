/* Copyright (c) 2006-2012 by OpenLayers Contributors (see authors.txt for 
 * full list of contributors). Published under the 2-clause BSD license.
 * See license.txt in the OpenLayers distribution or repository for the
 * full text of the license. */

/**
 * @requires OpenLayers/Strategy.js
 */

/**
 * Class: OpenLayers.Strategy.Cluster
 * Strategy for vector feature clustering.
 *
 * Inherits from:
 *  - <OpenLayers.Strategy>
 */
OpenLayers.Strategy.Cluster = OpenLayers.Class(OpenLayers.Strategy, {
    
    /**
     * APIProperty: distance
     * {Integer} Pixel distance between features that should be considered a
     *     single cluster.  Default is 20 pixels.
     */
    distance: 20,
    
    /**
     * APIProperty: threshold
     * {Integer} Optional threshold below which original features will be
     *     added to the layer instead of clusters.  For example, a threshold
     *     of 3 would mean that any time there are 2 or fewer features in
     *     a cluster, those features will be added directly to the layer instead
     *     of a cluster representing those features.  Default is null (which is
     *     equivalent to 1 - meaning that clusters may contain just one feature).
     */
    threshold: null,
    
    /**
     * Property: features
     * {Array(<OpenLayers.Feature.Vector>)} Cached features.
     */
    features: null,
    
    /**
     * Property: clusters
     * {Array(<OpenLayers.Feature.Vector>)} Calculated clusters.
     */
    clusters: null,
    
    /**
     * Property: clustering
     * {Boolean} The strategy is currently clustering features.
     */
    clustering: false,
    
    /**
     * Property: resolution
     * {Float} The resolution (map units per pixel) of the current cluster set.
     */
    resolution: null,

    /**
     * Constructor: OpenLayers.Strategy.Cluster
     * Create a new clustering strategy.
     *
     * Parameters:
     * options - {Object} Optional object whose properties will be set on the
     *     instance.
     */
    
    /**
     * APIMethod: activate
     * Activate the strategy.  Register any listeners, do appropriate setup.
     * 
     * Returns:
     * {Boolean} The strategy was successfully activated.
     */
    activate: function() {
        var activated = OpenLayers.Strategy.prototype.activate.call(this);
        if(activated) {
            this.layer.events.on({
                "beforefeaturesadded": this.cacheFeatures,
                "featuresremoved": this.clearCache,
                "moveend": this.startClustering,
                scope: this
            });
        }
        return activated;
    },
    
    /**
     * APIMethod: deactivate
     * Deactivate the strategy.  Unregister any listeners, do appropriate
     *     tear-down.
     * 
     * Returns:
     * {Boolean} The strategy was successfully deactivated.
     */
    deactivate: function() {
        var deactivated = OpenLayers.Strategy.prototype.deactivate.call(this);
        if(deactivated) {
            this.clearCache();
            this.layer.events.un({
                "beforefeaturesadded": this.cacheFeatures,
                "featuresremoved": this.clearCache,
                "moveend": this.startClustering,
                scope: this
            });
        }
        return deactivated;
    },
    
    /**
     * Method: cacheFeatures
     * Cache features before they are added to the layer.
     *
     * Parameters:
     * event - {Object} The event that this was listening for.  This will come
     *     with a batch of features to be clustered.
     *     
     * Returns:
     * {Boolean} False to stop features from being added to the layer.
     */
    cacheFeatures: function(event) {
        var propagate = true;
        if(!this.clustering) {
            this.clearCache();
            this.features = event.features;
            this.startClustering();
            propagate = false;
        }
        return propagate;
    },
    
    /**
     * Method: clearCache
     * Clear out the cached features.
     */
    clearCache: function() {
        if(!this.clustering) {
            this.features = null;
        }
    },

    /**
     * Method: cluster
     * Cluster features based on some threshold distance.
     *
     * Parameters:
     * event - {Object} The event received when cluster is called as a
     *     result of a moveend event.
     */
    startClustering: function(event) {
        if((!event || event.zoomChanged) && this.features) {
            var resolution = this.layer.map.getResolution();
                
            if(resolution != this.resolution || !this.clustersExist()) {
                this.resolution = resolution;

                var len = this.features.length,
                    coords = new Float32Array(2*len),
                    i;

                for ( i = 0; i < len; i++ ) {
                    if ( this.features[i].geometry ) {
                        coords[2*i] = this.features[i].geometry.x;
                        coords[2*i+1] = this.features[i].geometry.y;
                    }
                }

                var distance = ( typeof this.distance === "function" ?
                                 this.distance(this) : this.distance ),
                    radius = distance * this.resolution,
                    bbox = this.layer.getDataExtent(this.features),
                    buffer = coords.buffer,
                    me = this;

                if ( !this.worker ) {
                    this.worker = new Worker(
                        'OpenLayers/lib/OpenLayers/Strategy/QuadTree.js');
                }
                this.worker.addEventListener('message', function(e) {
                    me.finishClustering(new Int32Array(e.data.indices));
                }, false);
                this.worker.postMessage({
                    coords: buffer,
                    bbox: bbox,
                    radius: radius
                }, [buffer]);

            }
        }
    },

    finishClustering: function(indices) {
        var createCluster = true,
            clusters = [],
            i, len, cluster;

        for ( i = 0, len = indices.length; i < len; i++ ) {
            if ( indices[i] == -1 ) {
                createCluster = true;
                continue;
            }
            if ( createCluster ) {
                cluster = this.createCluster(
                    this.features[indices[i]]);
                clusters.push(cluster);
                createCluster = false;
            } else {
                this.addToCluster(
                    cluster, this.features[indices[i]]);
            }
        }

        this.clustering = true;
        this.layer.removeAllFeatures();
        this.clustering = false;
        if(clusters.length > 0) {
            if(this.threshold > 1) {
                var clone = clusters.slice();
                clusters = [];
                var candidate;
                for(i=0, len=clone.length; i<len; ++i) {
                    candidate = clone[i];
                    if(candidate.attributes.count < this.threshold) {
                        candidate.cluster.forEach(function(f) {
                            f.attributes.count = null;
                        });
                        Array.prototype.push.apply(clusters, candidate.cluster);
                    } else {
                        clusters.push(candidate);
                    }
                }
            }
            this.clustering = true;
            // A legitimate feature addition could occur during this
            // addFeatures call.  For clustering to behave well, features
            // should be removed from a layer before requesting a new batch.
            this.layer.addFeatures(clusters);
            this.clustering = false;
        }
        this.clusters = clusters;
        
    },
    
    /**
     * Method: clustersExist
     * Determine whether calculated clusters are already on the layer.
     *
     * Returns:
     * {Boolean} The calculated clusters are already on the layer.
     */
    clustersExist: function() {
        var exist = false;
        if(this.clusters && this.clusters.length > 0 &&
           this.clusters.length == this.layer.features.length) {
            exist = true;
            for(var i=0; i<this.clusters.length; ++i) {
                if(this.clusters[i] != this.layer.features[i]) {
                    exist = false;
                    break;
                }
            }
        }
        return exist;
    },
    
    /**
     * Method: addToCluster
     * Add a feature to a cluster.
     *
     * Parameters:
     * cluster - {<OpenLayers.Feature.Vector>} A cluster.
     * feature - {<OpenLayers.Feature.Vector>} A feature.
     */
    addToCluster: function(cluster, feature) {
        cluster.cluster.push(feature);
        feature.clustered = true;
        cluster.attributes.count += 1;
    },
    
    /**
     * Method: createCluster
     * Given a feature, create a cluster.
     *
     * Parameters:
     * feature - {<OpenLayers.Feature.Vector>}
     *
     * Returns:
     * {<OpenLayers.Feature.Vector>} A cluster.
     */
    createCluster: function(feature) {
        var center = feature.geometry.getBounds().getCenterLonLat();
        var cluster = new OpenLayers.Feature.Vector(
            new OpenLayers.Geometry.Point(center.lon, center.lat),
            {count: 1}
        );
        cluster.cluster = [feature];
        feature.clustered = true;
        return cluster;
    },

    CLASS_NAME: "OpenLayers.Strategy.Cluster" 
});
