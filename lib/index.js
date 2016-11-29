"use strict";

module.exports = FilterLayers;
var tilelive = require("tilelive"),
    url = require("url"),
    zlib = require("zlib"),
    mapnik = require("mapnik");


function FilterLayers(uri, callback) {
    var sourceThis = this;
    var parsedUrl = url.parse(uri, true);
    if(parsedUrl.query.layers == null) {
        return callback("layers not defined");
    }
    this._layers = parsedUrl.query.layers.split(",");
    var sourceUri = parsedUrl.query.source;
    console.log("loading source " + sourceUri);
    tilelive.load(sourceUri, function(err, source) {
        if(err) {
            callback(err);
        } else {
            sourceThis._source = source;
            callback(null, sourceThis);
        }
    });
};


FilterLayers.prototype.getTile = function(z, x, y, callback) {
    var layerNames = this._layers;
    this._source.getTile(z, x, y, function(err, data) {
        var vt = new mapnik.VectorTile(z, x, y);
        vt.setDataSync(data);

        var layers = [];
        for(var i = 0; i < layerNames.length; i++) {
            var layerTile = vt.layer(layerNames[i]);
            if(layerTile != null) {
                layers.push(layerTile);
            }
        }
    
        var compositeTile = new mapnik.VectorTile(z, x, y);
        compositeTile.composite(layers, {}, function(err) {
            return zlib.gzip(compositeTile.getData(), function(err, pbfz) {
                if (err) {
                    return callback(err);
                }
                return callback(null, pbfz, {
                    "Content-Encoding": "gzip",
                    "Content-Type": "application/x-protobuf",
                });
            });
        });
    });
};

FilterLayers.prototype.getInfo = function(callback) {
    var layers = this._layers;
    this._source.getInfo(function(err, data) {
        if(err) {
            callback(err);
        } else {
            var vectorLayers = [];
            for(var i = 0; i < layers.length; i++) {
                var layerDef = null;
                for(var j = 0; j < data.vector_layers.length; j++) {
                    if(data.vector_layers[j].id == layers[i]) {
                        layerDef = data.vector_layers[j];
                        break;
                    }
                }
                if(layerDef != null) {
                    vectorLayers.push(layerDef);
                }
            }
            data.vector_layers = vectorLayers;
            callback(null, data);
        }
    });
};

/*
    Register protocol with tilelive 
*/ 
FilterLayers.registerProtocols = function(tilelive) {
    tilelive.protocols['filterlayers:'] = FilterLayers;
};
FilterLayers.registerProtocols(tilelive);