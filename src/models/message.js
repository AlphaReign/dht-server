const { buffer, object } = require('nativemodels/datatypes');

module.exports = {
	a: object(),
	q: buffer().transform((value) => value.toString()),
	r: object(),
	t: buffer(),
	y: buffer().transform((value) => value.toString()),
};
