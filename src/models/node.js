const { buffer, int, string } = require('nativemodels/datatypes');
const getRandomId = require('./../utils/getRandomId');

module.exports = {
	address: string().required(),
	id: buffer().default(getRandomId()),
	port: int().required(),
};
