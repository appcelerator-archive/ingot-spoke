var ic = require('ingot-common'),
	request = require('request');

exports.getJob = getJob;
exports.runJob = runJob;

function getJob(url, params, callback) {
	console.info('spoke: getting a job from hub');

	request.post(url, function (err, res, body) {
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
	}).form(params);
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
			ic.printError(ex, 'spoke: get job error:');
		} finally {
			callback();
		}
	}).form({
		success: !error,
		result: JSON.stringify(results)
	});
}