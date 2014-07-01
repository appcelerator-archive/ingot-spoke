var Spoke = require('./lib/spoke'),
	spoke;

exports.load = function load() {
	//
};

exports.start = function start(cfg, callback) {
	spoke = new Spoke(cfg);
	spoke.init(callback);
};

exports.stop = function stop(cfg, callback) {
	spoke && spoke.shutdown(callback);
};

exports.unload = function unload() {
	//
};