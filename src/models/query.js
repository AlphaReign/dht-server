const { buffer, object } = require('nativemodels/datatypes');

module.exports = {
	a: object().required(),
	q: buffer()
		.required()
		.transform((value) => value.toString()),
	t: buffer().required(),
	y: buffer()
		.default('q')
		.transform((value) => value.toString()),
};
