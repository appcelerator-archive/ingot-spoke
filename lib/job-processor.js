var async = require('async'),
	request = require('request'),
	cfg,
	done = false,
	getJobTimer;

function printError(err) {
	(err.message || err.toString()).split('\n').forEach(function (line) {
		console.error('spoke: get job error: ' + line);
	});
}

function getJob(url, callback) {
	console.info('spoke: getting a job from hub');
	request.get(url, function (err, res, body) {
		if (err) return callback(err);

		if (res.statusCode === 204) {
			// no jobs right now, check back
			console.info('spoke: no jobs right now, checking back in a few seconds');
			return callback();

		}

		if (res.statusCode === 200) {
			try {
				var r = JSON.parse(body);
			} catch (ex) {
				return callback(ex);
			}
			if (!r.success) {
				return callback(new Error('get job failed:\n' + r.error));
			}
			return callback(null, r.result);
		}

		// error
		callback(new Error('get job failed with HTTP ' + res.statusCode + ':\n' + body));
	});
}

function runJob(job, callback) {
	// spawn the appropriate driver
	console.info('spoke: running job ' + job.id);
	setTimeout(function () {
		var results = {
			success: true,
			tests: [
				{ name: 'foo', passed: true, time: 234 },
				{ name: 'bar', passed: true, time: 456 }
			]
		};
		callback(null, results);
	}, 5000);
}

function submitResults(url, error, results, callback) {
	results || (results = {});
	if (error && !results.error) {
		results.error = error.message || error.toString();
	}

	// submit the results
	request.put(url, function (err, res, body) {
		try {
			if (err || parseInt(res.statusCode / 100) !== 2) {
				// error
				throw new Error('update job failed with HTTP ' + res.statusCode + ':\n' + body);
			}

			// success?
			var r = JSON.parse(body);
			if (!r.success) {
				throw new Error('update job failed:\n' + r.error);
			}
		} catch (ex) {
			printError(ex);
		} finally {
			callback();
		}
	}).form({
		success: !error,
		result: JSON.stringify(results)
	});
}

exports.run = function run(config) {
	cfg = config;
	cfg.spoke || (cfg.spoke = {});

	var timeout = cfg.spoke.timeout || 5000,
		getUrl = cfg.spoke.hub + '/api/job?machineId=' + escape(cfg.machineId) + '&types=' + escape(cfg.types.join(',')),
		putUrl = cfg.spoke.hub + '/api/job/';

	async.whilst(
		function () { return !done; },
		function (next) {
			getJob(getUrl, function (err, job) {
				if (err) {
					printError(err);
					return next();
				}

				if (!job) {
					// nothing to do
					getJobTimer = setTimeout(next, timeout);
					return;
				}

				console.info('spoke: got job ' + job.id);

				// run the job!
				runJob(job, function (err, results) {
					if (err) {
						printError(err);
					}
					console.info('spoke: submitting results for job ' + job.id);
					submitResults(putUrl + job.id, err, results, next);
				});
			});
		}
	);
};

exports.abort = function abort(callback) {
	clearTimeout(getJobTimer);
	done = true;
	callback();
};