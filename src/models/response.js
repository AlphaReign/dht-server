const { buffer, object } = require('nativemodels/datatypes');

module.exports = {
	r: object().required(),
	t: buffer().required(),
	y: buffer()
		.default('r')
		.transform((value) => value.toString()),
};
