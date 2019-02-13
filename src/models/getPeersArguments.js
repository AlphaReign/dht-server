const { buffer } = require('nativemodels/datatypes');

module.exports = {
	id: buffer(),
	info_hash: buffer()
		.strict()
		.transform((value) => value.toString('hex')),
};
