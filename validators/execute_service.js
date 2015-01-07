!function() {

    var   Validator = require('object-validators').Validator
        , types     = Validator.getValidator('type');



    module.exports = new Validator({
        name: {
              required  : true
            , type      : types.STRING
        }
        , serviceId: {
              required  : true
            , type      : types.STRING
        }
        , version: {
              required  : true
            , type      : types.STRING
            , semver    : true
        }
        , config: {
              required  : false
            , type      : types.OBJECT
        }
    });
}();
