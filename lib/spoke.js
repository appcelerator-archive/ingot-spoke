var appc = require('node-appc'),
	async = require('async'),
	ic = require('ingot-common'),
	os = require('os'),
	jobProcessor = require('./job-processor'),
	request = require('request');

module.exports = Spoke;

function Spoke(cfg) {
	this.cfg = appc.util.mix({ spoke: {} }, cfg);
	this.capabilities = {};
	this.machineId = null;
	this.hubURL = this.cfg.spoke.hub ? this.cfg.spoke.hub.replace(/\/$/, '') : 'http://localhost:8080';
	this.plugins = [];
	this.jobHandlers = {};
	this.running = false;
}

Spoke.prototype.init = function init(callback) {
	console.info('spoke: detecting environment');

	appc.async.series(this, [
		'_initCapabilities',
		'_loadPlugins',
		'_detectMachineId',
		'_registerWithHub',
		'_processJobs'
	], callback);
};

Spoke.prototype.shutdown = function shutdown(callback) {
	clearTimeout(this.getJobTimer);
	this.running = false;
	callback();
};

Spoke.prototype.registerJobHandler = function registerJobHandler(name, handler) {
	this.jobHandlers[name] = handler;
};

Spoke.prototype._initCapabilities = function _initCapabilities(callback) {
	this.capabilities = {
		'os': {
			'name': 'Mac OS X',
			'platform': 'osx',
			'version': '10.9.3',
			'architecture': '64bit',
			'numcpus': 8,
			'memory': 17179869184
		},
		'node': {
			'version': '0.10.29'
		},
		'titanium': {
			'3.4.0': {
				'version': '3.4.0',
				'path': '/Users/chris/Library/Application Support/Titanium/mobilesdk/osx/3.4.0',
				'platforms': [ 'android', 'iphone', 'mobileweb' ],
				'githash': 'ee98234',
				'timestamp': '06/13/14 16:07',
				'nodeAppcVer': '0.2.11'
			}
		},
		'jdk': {
			'version': '1.6.0',
			'build': 65,
			'architecture': '64bit',
		},
		'titaniumCLI': {
			'version': '3.3.0-dev',
			'nodeAppcVer': '0.2.6',
			'selectedSDK': '3.4.0'
		},
		'xcode': {
			'5.0.2:5A3005': {
				'path': '/Applications/Xcode-5.0.2.app/Contents/Developer',
				'selected': false,
				'version': '5.0.2',
				'build': '5A3005',
				'sdks': [ '7.0.3' ],
				'sims': [ '6.1', '7.0.3' ]
			},
			'5.1.1:5B1008': {
				'path': '/Applications/Xcode-5.1.1.app/Contents/Developer',
				'selected': true,
				'version': '5.1.1',
				'build': '5B1008',
				'sdks': [ '7.1' ],
				'sims': [ '6.1', '7.0.3', '7.1' ]
			}
		},
		'devices': [
			{
				'udid': 'd4fa1bddc406d1bda71b6adbd49c454b13f2e772',
				'name': 'Big Black',
				'buildVersion': '10B350',
				'cpuArchitecture': 'armv7s',
				'deviceClass': 'iPhone',
				'deviceColor': 'black',
				'hardwareModel': 'N41AP',
				'modelNumber': 'MD636',
				'productType': 'iPhone5,1',
				'productVersion': '6.1.4',
				'serialNumber': 'F2LJF8GSDTTQ',
				'id': 'd4fa1bddc406d1bda71b6adbd49c454b13f2e772'
			}
		]
	};

	callback();
};

Spoke.prototype._loadPlugins = function _loadPlugins(callback) {
	console.info('spoke: loading plugins');

	var _t = this,
		pp = this.cfg.spoke.plugins || null;

	if (!Array.isArray(pp)) {
		// load all plugins
		pp = ic.findModules('plugin');
	}

	async.eachSeries(pp, function (plugin, cb) {
		console.info('spoke: loading plugin: ' + plugin);
		var p = require(plugin);
		_t.plugins.push(p);

		if (typeof p.init !== 'function') {
			return cb();
		}

		p.init(_t, function (err, caps) {
			if (err) {
				ic.printError(ex, 'spoke: error calling plugin config:');
			} else if (caps !== null && typeof caps === 'object') {
				appc.util.mix(_t.capabilities, caps);
			}
			cb();
		});
	}, callback);
};

Spoke.prototype._detectMachineId = function _detectMachineId(callback) {
	// ioreg -rd1 -c IOPlatformExpertDevice
	// OR
	// /usr/sbin/system_profiler SPHardwareDataType | grep "Hardware UUID" | awk '{print $3}'
	this.machineId = 'CBC33EE3-26BE-59ED-9204-D0118BD1E4E4';
	callback();
};

Spoke.prototype._registerWithHub = function _registerWithHub(callback) {
	console.info('spoke: registering with hub (%s)', this.hubURL);

	request.post(this.hubURL + '/api/register', function (err, res, body) {
		try {
			if (err || parseInt(res.statusCode / 100) !== 2) {
				// error
				throw new Error('registration failed with HTTP ' + res.statusCode + ':\n' + body);
			}

			// success?
			var r = JSON.parse(body);
			if (!r.success) {
				throw new Error('registration failed:\n' + r.error);
			}

			callback();
		} catch (ex) {
			callback(ex);
		}
	}).form({
		machineId: this.machineId,
		hostname: os.hostname(),
		version: require('../package.json').version
	});
};

Spoke.prototype._processJobs = function _processJobs(callback) {
	var _t = this;
		timeout = this.cfg.spoke.timeout || 5000,
		getUrl = this.hubURL + '/api/get-next-job?machineId=' + escape(this.machineId);

	process.nextTick(function () {
		_t.running = true;

		async.whilst(
			function () { return _t.running; },
			function (next) {
				jobProcessor.getJob(getUrl, {
					capabilities: JSON.stringify(_t.capabilities),
					types: Object.keys(_t.jobHandlers).join(',')
				}, function (err, job) {
					if (err) {
						ic.printError(err, 'spoke: get job error:');
						return next();
					}

					if (!job) {
						// nothing to do
						_t.getJobTimer = setTimeout(next, timeout);
						return;
					}

					console.info('spoke: got job ' + job.id);

					var jobHandler = _t.jobHandlers[job.type];
					if (!jobHandler) {
						console.error('spoke: unable to process job type ' + job.type);
						_t.getJobTimer = setTimeout(next, timeout);
						return;
					}

					// run the job!
					console.info('spoke: running job ' + job.id);

					try {
						jobHandler(job, function (err, results) {
							if (err) {
								ic.printError(err, 'spoke: run job error:');
							}
							console.info('spoke: submitting results for job ' + job.id);
							jobProcessor.submitResults(_t.hubURL + '/api/job/' + job.id, err, results, next);
						});
					} catch (ex) {
						ic.printError(err, 'spoke: run job error:');
					}
				});
			}
		);
	}.bind(this));

	callback();
};