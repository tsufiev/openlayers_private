/*
 The MIT License

 Copyright (c) 2011 Mike Chambers

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */


/**
 * A QuadTree implementation in JavaScript, a 2d spatial subdivision algorithm.
 * @module QuadTree
 **/

(function(window) {
    
    /****************** QuadTree ****************/

    /**
     * QuadTree data structure.
     * @class QuadTree
     * @constructor
     * @param {Object} An object representing the bounds of the top level of the QuadTree. The object 
     * should contain the following properties : x, y, width, height
     * @param {Boolean} pointQuad Whether the QuadTree will contain points (true), or items with bounds 
     * (width / height)(false). Default value is false.
     * @param {Number} maxDepth The maximum number of levels that the quadtree will create. Default is 50.
     * @param {Number} maxChildren The maximum number of children that a node can contain before it is split into sub-nodes.
     **/
    function QuadTree(bbox, maxDepth, maxChildren)
    {	
	var node = new Node(bbox, 0, maxDepth, maxChildren);
	this.root = node;
    };

    /**
     * The root node of the QuadTree which covers the entire area being segmented.
     * @property root
     * @type Node
     **/
    QuadTree.prototype.root = null;


    /**
     * Inserts an item into the QuadTree.
     * @method insert
     * @param {Object|Array} item The item or Array of items to be inserted into the QuadTree. The item should expose x, y 
     * properties that represents its position in 2D space.
     **/
    QuadTree.prototype.insert = function(item)
    {
	if(item instanceof Array)
	{
	    var len = item.length;
	    
	    for(var i = 0; i < len; i++)
	    {
		this.root.insert(item[i]);
	    }
	}
	else
	{
	    this.root.insert(item);
	}
    };

    /**
     * Clears all nodes and children from the QuadTree
     * @method clear
     **/
    QuadTree.prototype.clear = function()
    {
	this.root.clear();
    };

    /**
     * Retrieves all items / points in the same node as the specified item / point. If the specified item
     * overlaps the bounds of a node, then all children in both nodes will be returned.
     * @method retrieve
     * @param {Object} item An object representing a 2D coordinate point (with x, y properties), or a shape
     * with dimensions (x, y, width, height) properties.
     **/
    QuadTree.prototype.retrieve = function(item)
    {
	//get a copy of the array of items
	var out = this.root.retrieve(item).slice(0);
	return out;
    };

    QuadTree.prototype.retrieveBBox = function(item)
    {
	//get a copy of the array of items
	var out = this.root.retrieveBBox(item).slice(0);
	return out;
    };

    /************** Node ********************/


    function Node(bbox, depth, maxDepth, maxChildren)
    {
	this.bbox = new BBox(bbox.left, bbox.bottom, bbox.right, bbox.top);
	this.children = [];
	this.nodes = [];
	
	if(maxChildren)
	{
	    this._maxChildren = maxChildren;
	    
	}
	
	if(maxDepth)
	{
	    this._maxDepth = maxDepth;
	}
	
	if(depth)
	{
	    this._depth = depth;
	}
    };

    //subnodes
    Node.prototype.nodes = null;

    //children contained directly in the node
    Node.prototype.children = null;
    Node.prototype.bbox = null;

    //read only
    Node.prototype._depth = 0;

    Node.prototype._maxChildren = 4;
    Node.prototype._maxDepth = 50;

    Node.TOP_LEFT = 0;
    Node.TOP_RIGHT = 1;
    Node.BOTTOM_LEFT = 2;
    Node.BOTTOM_RIGHT = 3;


    Node.prototype.insert = function(item)
    {
	if(this.nodes.length)
	{
	    var index = this._findIndex(item);
	    
	    this.nodes[index].insert(item);
	    
	    return;
	}

	this.children.push(item);

	var len = this.children.length;
	if(!(this._depth >= this._maxDepth) && 
	   len > this._maxChildren)
	{
	    this.subdivide();
	    
	    for(var i = 0; i < len; i++)
	    {
		this.insert(this.children[i]);
	    }
	    
	    this.children.length = 0;
	}
    };

    Node.prototype.retrieveNode = function(item)
    {
	if(this.nodes.length)
	{
	    var index = this._findIndex(item);
	    
	    return this.nodes[index].retrieve(item);
	}
	
	return this;
    };

    Node.prototype.retrieve = function(item)
    {
        return this.retrieveNode(item).children;
    };

    Node.prototype.retrieveBBox = function(bbox) {
        var items = [],
            i, child;
        if ( !this.clustered ) {
            if ( !bbox || bbox.containsBBox(this.bbox) ) {
                for ( i = 0; i < this.children.length; i++ ) {
                    child = this.children[i];
                    if ( !child.clustered ) {
                        items.push(child);
                        child.clustered = true;
                    }
                }
                for ( i = 0; i < this.nodes.length; i++ ) {
                    items = items.concat(this.nodes[i].retrieveBBox());
                    this.nodes[i].clustered = true;
                }
            } else if ( bbox.intersectsBBox(this.bbox) ) {
                for ( i = 0; i < this.children.length; i++ ) {
                    child = this.children[i];
                    if ( !child.clustered && bbox.contains(child.x, child.y) ) {
                        items.push(child);      
                        child.clustered = true;
                    }
                }
                for ( i = 0; i < this.nodes.length; i++ )
                    items = items.concat(this.nodes[i].retrieveBBox(bbox));
            }
        }
        return items;
    };

    Node.prototype._findIndex = function(item)
    {
	var b = this.bbox,
	    left = !(item.x > (b.left + b.right)/2 ),
	    top = (item.y > (b.top + b.bottom)/2 );
	
	var index = Node.TOP_LEFT;
	if (left) {
	    if(!top)
		index = Node.BOTTOM_LEFT;
        }
	else {
	    if(top)
		index = Node.TOP_RIGHT;
	    else
	        index = Node.BOTTOM_RIGHT;
        }
	
	return index;
    };


    Node.prototype.subdivide = function()
    {
	var depth = this._depth + 1,
            top = this.bbox.top, bottom = this.bbox.bottom,
            left = this.bbox.left, right = this.bbox.right,
            middle_x = (left+right)/2, middle_y = (top+bottom)/2;
	
	//top left
	this.nodes[Node.TOP_LEFT] = new Node(
            new BBox(left, middle_y, middle_x, top), depth);
	
	//top right
	this.nodes[Node.TOP_RIGHT] = new Node(
            new BBox(middle_x, middle_y, right, top), depth);
	
	//bottom left
	this.nodes[Node.BOTTOM_LEFT] = new Node(
            new BBox(left, bottom, middle_x, middle_y), depth);
	
	//bottom right
	this.nodes[Node.BOTTOM_RIGHT] = new Node(
            new BBox(middle_x, bottom, right, middle_y), depth);	
    };

    Node.prototype.clear = function()
    {	
	this.children.length = 0;
	
	var len = this.nodes.length;
	for(var i = 0; i < len; i++)
	{
	    this.nodes[i].clear();
	}
	
	this.nodes.length = 0;
    };

    window.QuadTree = QuadTree;

    /*
     //http://ejohn.org/blog/objectgetprototypeof/
     if ( typeof Object.getPrototypeOf !== "function" ) {
     if ( typeof "test".__proto__ === "object" ) {
     Object.getPrototypeOf = function(object){
     return object.__proto__;
     };
     } else {
     Object.getPrototypeOf = function(object){
     // May break if the constructor has been tampered with
     return object.constructor.prototype;
     };
     }
     }
     */

    function Item(index, x, y) {
        this.index = index;
        this.x = x;
        this.y = y;
    };

    function BBox(left, bottom, right, top) {
        this.left = left;
        this.bottom = bottom;
        this.right = right;
        this.top = top;
    };

    BBox.prototype.contains = function(x, y) {
        return (y > this.bottom) && (x > this.left) &&
            (y < this.top) && (x < this.right);
    };

    BBox.prototype.containsBBox = function(bbox) {
        var bottomLeft = this.contains(bbox.left, bbox.bottom),
            topRight = this.contains(bbox.right, bbox.top);
        return bottomLeft && topRight;
    };

    BBox.prototype.intersectsBBox = function(bbox) {
        return ( ( ( bbox.left<this.left && this.left<bbox.right ) ||
                   ( this.left<bbox.left && bbox.left<this.right ) ) &&
                 ( ( bbox.bottom<this.bottom && this.bottom<bbox.top ) ||
                   ( this.bottom<bbox.bottom && bbox.bottom<this.top) ) );
    };

    QuadTree.prototype.clusterWithQuad = function(coords, radius) {
        var item, i, len,
            items = [], indices = [];

        // QuadTree Initialization
        for ( i = 0, len = coords.length/2; i < len; i++ ) {
            if ( coords[2*i] && 
                 this.root.bbox.contains(coords[2*i], coords[2*i+1]) )
                items.push(new Item(i, coords[2*i], coords[2*i+1]));
        }
        this.insert(items);

        // Clustering
        for ( i = 0, len = items.length; i < len; i++ ) {
            item = items[i];
            if ( !item.clustered ) {
                var bbox = new BBox(item.x-radius, item.y-radius, 
                                    item.x+radius, item.y+radius),
                    retrieved = this.retrieveBBox(bbox);
                indices = indices.concat(retrieved.map(function(item) {
                    item.clustered = true;
                    return item.index;
                }));
                indices.push(-1);
            }
        }
        return new Int32Array(indices);
    };

}(self));

self.addEventListener('message', function(e) {
    var quadTree = new self.QuadTree(e.data.bbox),
        coords = new Float32Array(e.data.coords),
        indices = quadTree.clusterWithQuad(coords, e.data.radius),
        buffer = indices.buffer;

    self.postMessage({ indices: buffer }, [buffer]);
    quadTree.clear();
}, false);
