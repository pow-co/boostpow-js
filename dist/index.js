"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const boost_header_model_1 = require("./boost-header-model");
const defaultOptions = {
    api_url: 'https://api.matterpool.io',
    network: 'bsv',
    version_path: 'api/v1',
};
class BoostClient {
    constructor(providedOptions) {
        this.options = Object.assign({}, defaultOptions, providedOptions);
    }
    get BoostHeader() {
        return boost_header_model_1.BoostHeaderModel;
    }
    setOptions(newOptions) {
        this.options = Object.assign({}, this.options, newOptions);
    }
    static instance(newOptions) {
        const mergedOptions = Object.assign({}, defaultOptions, newOptions);
        return new BoostClient(mergedOptions);
    }
}
exports.BoostClient = BoostClient;
function instance(newOptions) {
    const mergedOptions = Object.assign({}, defaultOptions, newOptions);
    return new BoostClient(mergedOptions);
}
exports.instance = instance;
try {
    if (window) {
        window['Boost'] = {
            Service: new BoostClient(),
            BoostHeader: boost_header_model_1.BoostHeaderModel
        };
    }
}
catch (ex) {
    // Window is not defined, must be running in windowless env....
}
exports.BoostHeader = boost_header_model_1.BoostHeaderModel;
