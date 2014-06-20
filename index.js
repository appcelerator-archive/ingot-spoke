var os = require('os'),
	request = require('request');

exports.load = function load() {
	//
};

exports.start = function start(cfg, callback) {
	cfg || (cfg = {});
	cfg.spoke || (cfg.spoke = {});
	typeof callback !== 'function' && (callback = function () {});

	console.info('spoke: detecting environment');
	var capabilities = [
		{
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
		}
	];

	var hub = cfg.spoke.hub || 'http://localhost:8080';
	/\/$/.test(hub) && (hub.substring(0, hub.length - 2));
	console.info('spoke: registering with hub (%s)', hub);

	request.post(hub + '/api/register', function (err, res, body) {
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
		machineId: 'CBC33EE3-26BE-59ED-9204-D0118BD1E4E4', // ioreg -rd1 -c IOPlatformExpertDevice, /usr/sbin/system_profiler SPHardwareDataType | grep "Hardware UUID" | awk '{print $3}'
		hostname: os.hostname(),
		version: require('./package.json').version,
		capabilities: JSON.stringify(capabilities)
	});
};

exports.stop = function stop() {
	//
};

exports.unload = function unload() {
	//
};