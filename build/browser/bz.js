(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// this file is the entrypoint for building a browser file with browserify

"use strict";

var bz = window.bz = require("./index");

},{"./index":2}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

exports.createClient = createClient;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var XMLHttpRequest = require('./xhr').XMLHttpRequest;

/**
Constant for the login entrypoint.
*/
var LOGIN = '/login';

/**
Errors related to the socket timeout.
*/
var TIMEOUT_ERRORS = ['ETIMEDOUT', 'ESOCKETTIMEDOUT'];

function extractField(id, callback) {
  if (typeof id === 'function') {
    callback = id;
    id = undefined;
  }

  return function (err, response) {
    if (err) return callback(err);

    if (response) {
      // default behavior is to use the first id when the caller does not provide one.
      if (id === undefined) {
        id = Object.keys(response)[0];
      }
      callback(null, response[id]);
    } else {
      throw 'Error:, no response in extractField';
    }
  };
}

/**
Function decorator which will attempt to login to bugzilla
with the current credentials prior to making the actual api call.

    Bugzilla.prototype.method = login(function(param, param) {
    });

@param {Function} method to decorate.
@return {Function} decorated method.
*/
function loginRequired(method) {
  // we assume this is a valid bugilla instance.
  return function () {
    // remember |this| is a bugzilla instance

    // args for the decorated method
    var args = Array.prototype.slice.call(arguments),

    // we need the callback so we can pass login related errors.
    callback = args[args.length - 1];

    this.login((function (err) {
      if (err) return callback(err);

      // we are now logged in so the method can run!
      method.apply(this, args);
    }).bind(this));
  };
}

var BugzillaClient = (function () {
  var _class = function BugzillaClient(options) {
    _classCallCheck(this, _class);

    options = options || {};

    this.username = options.username;
    this.password = options.password;
    this.timeout = options.timeout || 0;

    if (options.test) {
      throw new Error('options.test is deprecated please specify the url directly');
    }

    this.apiUrl = options.url || 'https://bugzilla.mozilla.org/rest/';
    this.apiUrl = this.apiUrl.replace(/\/$/, '');

    this._auth = null;
  };

  _createClass(_class, [{
    key: 'login',

    /**
    Authentication details for given user.
      Example:
          { id: 1222, token: 'xxxx' }
      @type {Object}
    */

    /**
    In the REST API we first login to acquire a token which is then used to make
    requests. See: http://bzr.mozilla.org/bmo/4.2/view/head:/Bugzilla/WebService/Server/REST.pm#L556
      This method can be used publicly but is designed for internal consumption for
    ease of use.
      @param {Function} callback [Error err, String token].
    */
    value: function login(callback) {

      if (this._auth) {
        callback(null, this._auth);
      }

      if (!this.username || !this.password) {
        throw new Error('missing or invalid .username or .password');
      }

      var params = {
        login: this.username,
        password: this.password
      };

      var handleLogin = (function handleLogin(err, response) {
        if (err) return callback(err);
        if (response.result) {
          this._auth = response.result;
        } else {
          this._auth = response;
        }
        callback(null, response);
      }).bind(this);

      this.APIRequest('/login', 'GET', handleLogin, null, null, params);
    }
  }, {
    key: 'getBug',
    value: function getBug(id, params, callback) {
      // console.log("args", [].slice.call(arguments));
      if (!callback) {
        callback = params;
        params = {};
      }

      // console.log('getBug>', id, params, callback);

      this.APIRequest('/bug/' + id, 'GET', extractField(callback), 'bugs', null, params);
    }
  }, {
    key: 'searchBugs',
    value: function searchBugs(params, callback) {
      this.APIRequest('/bug', 'GET', callback, 'bugs', null, params);
    }
  }, {
    key: 'updateBug',
    value: function updateBug(id, bug, callback) {
      var _this = this;

      this.login(function (err, response) {
        if (err) throw err;
        // console.log("updateBug>", response);
        _this.APIRequest('/bug/' + id, 'PUT', callback, 'bugs', bug);
      });
    }
  }, {
    key: 'createBug',
    value: function createBug(bug, callback) {
      this.APIRequest('/bug', 'POST', callback, 'id', bug);
    }
  }, {
    key: 'bugComments',
    value: function bugComments(id, callback) {
      return this.bugCommentsSince(id, null, callback);
    }
  }, {
    key: 'bugCommentsSince',
    value: function bugCommentsSince(id, date, callback) {
      var _callback = function _callback(e, r) {
        if (e) throw e;
        var _bug_comments = r[id];
        if (typeof _bug_comments['comments'] !== 'undefined') {
          // bugzilla 5 :(
          _bug_comments = _bug_comments.comments;
        }
        callback(null, _bug_comments);
      };

      var params = date ? { new_since: date } : null;

      this.APIRequest('/bug/' + id + '/comment', 'GET', _callback, 'bugs', null, params);
    }
  }, {
    key: 'addComment',
    value: function addComment(id, comment, callback) {
      this.APIRequest('/bug/' + id + '/comment', 'POST', callback, null, comment);
    }
  }, {
    key: 'bugHistory',
    value: function bugHistory(id, callback) {
      return this.bugHistorySince(id, null, callback);
    }
  }, {
    key: 'bugHistorySince',
    value: function bugHistorySince(id, date, callback) {
      var params = date ? { new_since: date } : null;

      this.APIRequest('/bug/' + id + '/history', 'GET', callback, 'bugs', null, params);
    }
  }, {
    key: 'bugAttachments',

    /**
     * Finds all attachments for a given bug #
     * http://www.bugzilla.org/docs/tip/en/html/api/Bugzilla/WebService/Bug.html#attachments
     *
     * @param {Number} id of bug.
     * @param {Function} [Error, Array<Attachment>].
     */
    value: function bugAttachments(id, params, callback) {
      this.APIRequest('/bug/' + id + '/attachment', 'GET', extractField(id, callback), 'bugs', null, params);
    }
  }, {
    key: 'createAttachment',
    value: function createAttachment(id, attachment, callback) {
      this.APIRequest('/bug/' + id + '/attachment', 'POST', extractField(callback), 'ids', attachment);
    }
  }, {
    key: 'getAttachment',
    value: function getAttachment(id, callback) {
      this.APIRequest('/bug/attachment/' + id, 'GET', extractField(callback), 'attachments');
    }
  }, {
    key: 'updateAttachment',
    value: function updateAttachment(id, attachment, callback) {
      this.APIRequest('/bug/attachment/' + id, 'PUT', callback, 'ok', attachment);
    }
  }, {
    key: 'searchUsers',
    value: function searchUsers(match, callback) {
      this.APIRequest('/user', 'GET', callback, 'users', null, { match: match });
    }
  }, {
    key: 'getUser',
    value: function getUser(id, callback) {
      this.APIRequest('/user/' + id, 'GET', extractField(callback), 'users');
    }
  }, {
    key: 'getSuggestedReviewers',
    value: function getSuggestedReviewers(id, callback) {
      // BMO- specific extension to get suggested reviewers for a given bug
      // http://bzr.mozilla.org/bmo/4.2/view/head:/extensions/Review/lib/WebService.pm#L102
      this.APIRequest('/review/suggestions/' + id, 'GET', callback);
    }
  }, {
    key: 'getConfiguration',

    /*
      XXX this call is provided for convenience to people scripting against prod bugzillq
      THERE IS NO EQUIVALENT REST CALL IN TIP, so this should not be tested against tip, hence
      the hard-coded url.
    */
    value: function getConfiguration(params, callback) {
      if (!callback) {
        callback = params;
        params = {};
      }

      // this.APIRequest('/configuration', 'GET', callback, null, null, params);
      // UGLAY temp fix until /configuration is implemented,
      // see https://bugzilla.mozilla.org/show_bug.cgi?id=924405#c11:
      var that = this;

      var req = new XMLHttpRequest();
      req.open('GET', 'https://api-dev.bugzilla.mozilla.org/latest/configuration', true);
      req.setRequestHeader('Accept', 'application/json');
      req.onreadystatechange = function (event) {
        if (req.readyState == 4 && req.status != 0) {
          that.handleResponse(null, req, callback);
        }
      };
      req.timeout = this.timeout;
      req.ontimeout = function (event) {
        that.handleResponse('timeout', req, callback);
      };
      req.onerror = function (event) {
        that.handleResponse('error', req, callback);
      };
      req.send();
    }
  }, {
    key: 'APIRequest',
    value: function APIRequest(path, method, callback, field, body, params) {
      if (
      // if we are doing the login
      path === LOGIN ||
      // if we are already authed
      this._auth ||
      // or we are missing auth data
      !this.password || !this.username) {
        // skip automatic authentication
        return this._APIRequest.apply(this, arguments);
      }

      // so we can pass the arguments inside of another function
      var args = [].slice.call(arguments);

      this.login((function (err) {
        if (err) return callback(err);
        this._APIRequest.apply(this, args);
      }).bind(this));
    }
  }, {
    key: '_APIRequest',
    value: function _APIRequest(path, method, callback, field, body, params) {
      var url = this.apiUrl + path;

      params = params || {};

      if (this._auth) {
        params.token = this._auth.token;
      } else if (this.username && this.password) {
        params.username = this.username;
        params.password = this.password;
      }

      if (params && Object.keys(params).length > 0) {
        url += '?' + this.urlEncode(params);
      }

      body = JSON.stringify(body);

      var that = this;

      var req = new XMLHttpRequest();
      req.open(method, url, true);
      req.setRequestHeader('Accept', 'application/json');
      if (method.toUpperCase() !== 'GET') {
        req.setRequestHeader('Content-Type', 'application/json');
      }
      req.onreadystatechange = function (event) {
        if (req.readyState == 4 && req.status != 0) {
          that.handleResponse(null, req, callback, field);
        }
      };
      req.timeout = this.timeout;
      req.ontimeout = function (event) {
        that.handleResponse('timeout', req, callback);
      };
      req.onerror = function (event) {
        that.handleResponse(event, req, callback);
      };
      req.send(body);
    }
  }, {
    key: 'handleResponse',
    value: function handleResponse(err, response, callback, field) {
      // detect timeout errors
      if (err && err.code && TIMEOUT_ERRORS.indexOf(err.code) !== -1) {
        return callback(new Error('timeout'));
      }

      // handle generic errors
      if (err) return callback(err);

      // anything in 200 status range is a success
      var requestSuccessful = response.status > 199 && response.status < 300;

      // even in the case of an unsuccessful request we may have json data.
      var parsedBody;

      try {
        parsedBody = JSON.parse(response.responseText);
      } catch (e) {
        // XXX: might want to handle this better in the request success case?
        if (requestSuccessful) {
          return callback(new Error('response was not valid json: ' + response.responseText));
        }
      }

      // detect if we're running Bugzilla 5.0
      if (typeof parsedBody['result'] !== 'undefined') {
        parsedBody = parsedBody['result'];
      }

      // successful http respnse but an error
      // XXX: this seems like a bug in the api.
      if (parsedBody && parsedBody.error) {
        requestSuccessful = false;
      }

      if (!requestSuccessful) {
        return callback(new Error('HTTP status ' + response.status + '\n' + (parsedBody && parsedBody.message) ? parsedBody.message : ''));
      }

      callback(null, field ? parsedBody[field] : parsedBody);
    }
  }, {
    key: 'urlEncode',
    value: function urlEncode(params) {
      var url = [];
      for (var param in params) {
        var values = params[param];
        if (!values.forEach) values = [values];
        // expand any arrays
        values.forEach(function (value) {
          url.push(encodeURIComponent(param) + '=' + encodeURIComponent(value));
        });
      }
      return url.join('&');
    }
  }]);

  return _class;
})();

exports.BugzillaClient = BugzillaClient;

function createClient(options) {
  return new BugzillaClient(options);
}

// note intentional use of != instead of !==

},{"./xhr":3}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
var XMLHttpRequest = null;

exports.XMLHttpRequest = XMLHttpRequest;
if (typeof window === 'undefined') {
  // we're not in a browser?
  var _loader = require;
  try {
    exports.XMLHttpRequest = XMLHttpRequest = _loader('sdk/net/xhr').XMLHttpRequest;
  } catch (e) {
    exports.XMLHttpRequest = XMLHttpRequest = _loader('xmlhttprequest').XMLHttpRequest;
  }
} else if (typeof window !== 'undefined' && typeof window.XMLHttpRequest !== 'undefined') {
  exports.XMLHttpRequest = XMLHttpRequest = window.XMLHttpRequest;
} else {
  throw 'No window, WAT.';
}

},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkOi9EZXZlbG9wbWVudC9iei5qZC1qdWxpYW5kZXNjb3R0ZXMvc3JjL2J6LmpzIiwiZDovRGV2ZWxvcG1lbnQvYnouamQtanVsaWFuZGVzY290dGVzL3NyYy9pbmRleC5qcyIsImQ6L0RldmVsb3BtZW50L2J6LmpkLWp1bGlhbmRlc2NvdHRlcy9zcmMveGhyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7OztBQ0VBLElBQUksRUFBRSxHQUFHLE1BQU0sQ0FBQyxFQUFFLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDOzs7Ozs7Ozs7OztRQ3dieEIsWUFBWSxHQUFaLFlBQVk7Ozs7QUExYjVCLElBQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxjQUFjLENBQUM7Ozs7O0FBS3ZELElBQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQzs7Ozs7QUFLdkIsSUFBTSxjQUFjLEdBQUcsQ0FBQyxXQUFXLEVBQUUsaUJBQWlCLENBQUMsQ0FBQzs7QUFFeEQsU0FBUyxZQUFZLENBQUMsRUFBRSxFQUFFLFFBQVEsRUFBRTtBQUNsQyxNQUFJLE9BQU8sRUFBRSxLQUFLLFVBQVUsRUFBRTtBQUM1QixZQUFRLEdBQUcsRUFBRSxDQUFDO0FBQ2QsTUFBRSxHQUFHLFNBQVMsQ0FBQztHQUNoQjs7QUFFRCxTQUFPLFVBQVMsR0FBRyxFQUFFLFFBQVEsRUFBRTtBQUM3QixRQUFJLEdBQUcsRUFBRSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQzs7QUFFOUIsUUFBSSxRQUFRLEVBQUU7O0FBRVosVUFBSSxFQUFFLEtBQUssU0FBUyxFQUFFO0FBQ3BCLFVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO09BQy9CO0FBQ0QsY0FBUSxDQUFDLElBQUksRUFBRSxRQUFRLENB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ZCxjQUFjO0FBRXpCLElBQUksT0FBTyxNQUFNLEtBQUssV0FBVyxFQUFFOztBQUVqQyxNQUFJLE9BQU8sR0FBRyxPQUFPLENBQUM7QUFDdEIsTUFBSTtBQUNGLFlBTk8sY0FBYyxHQU1yQixjQUFjLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDLGNBQWMsQ0FBQztHQUN4RCxDQUFDLE9BQU0sQ0FBQyxFQUFFO0FBQ1QsWUFSTyxjQUFjLEdBUXJCLGNBQWMsR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxjQUFjLENBQUM7R0FDM0Q7Q0FDRixNQUNJLElBQUcsT0FBTyxNQUFNLEtBQUssV0FBVyxJQUFJLE9BQU8sTUFBTSxDQUFDLGNBQWMsS0FBSyxXQUFXLEVBQUU7QUFDckYsVUFaUyxjQUFjLEdBWXZCLGNBQWMsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDO0NBQ3hDLE1BQ0k7QUFDSCxRQUFNLGlCQUFpQixDQUFBO0NBQ3hCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIHRoaXMgZmlsZSBpcyB0aGUgZW50cnlwb2ludCBmb3IgYnVpbGRpbmcgYSBicm93c2VyIGZpbGUgd2l0aCBicm93c2VyaWZ5XHJcblxyXG52YXIgYnogPSB3aW5kb3cuYnogPSByZXF1aXJlKFwiLi9pbmRleFwiKTsiLCJjb25zdCBYTUxIdHRwUmVxdWVzdCA9IHJlcXVpcmUoJy4veGhyJykuWE1MSHR0cFJlcXVlc3Q7XHJcblxyXG4vKipcclxuQ29uc3RhbnQgZm9yIHRoZSBsb2dpbiBlbnRyeXBvaW50LlxyXG4qL1xyXG5jb25zdCBMT0dJTiA9ICcvbG9naW4nO1xyXG5cclxuLyoqXHJcbkVycm9ycyByZWxhdGVkIHRvIHRoZSBzb2NrZXQgdGltZW91dC5cclxuKi9cclxuY29uc3QgVElNRU9VVF9FUlJPUlMgPSBbJ0VUSU1FRE9VVCcsICdFU09DS0VUVElNRURPVVQnXTtcclxuXHJcbmZ1bmN0aW9uIGV4dHJhY3RGaWVsZChpZCwgY2FsbGJhY2spIHtcclxuICBpZiAodHlwZW9mIGlkID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICBjYWxsYmFjayA9IGlkO1xyXG4gICAgaWQgPSB1bmRlZmluZWQ7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZnVuY3Rpb24oZXJyLCByZXNwb25zZSkge1xyXG4gICAgaWYgKGVycikgcmV0dXJuIGNhbGxiYWNrKGVycik7XHJcblxyXG4gICAgaWYgKHJlc3BvbnNlKSB7XHJcbiAgICAgIC8vIGRlZmF1bHQgYmVoYXZpb3IgaXMgdG8gdXNlIHRoZSBmaXJzdCBpZCB3aGVuIHRoZSBjYWxsZXIgZG9lcyBub3QgcHJvdmlkZSBvbmUuXHJcbiAgICAgIGlmIChpZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgaWQgPSBPYmplY3Qua2V5cyhyZXNwb25zZSlbMF07XHJcbiAgICAgIH1cclxuICAgICAgY2FsbGJhY2sobnVsbCwgcmVzcG9uc2VbaWRdKTtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICB0aHJvdyBcIkVycm9yOiwgbm8gcmVzcG9uc2UgaW4gZXh0cmFjdEZpZWxkXCI7XHJcbiAgICB9XHJcbiAgfTtcclxufVxyXG5cclxuLyoqXHJcbkZ1bmN0aW9uIGRlY29yYXRvciB3aGljaCB3aWxsIGF0dGVtcHQgdG8gbG9naW4gdG8gYnVnemlsbGFcclxud2l0aCB0aGUgY3VycmVudCBjcmVkZW50aWFscyBwcmlvciB0byBtYWtpbmcgdGhlIGFjdHVhbCBhcGkgY2FsbC5cclxuXHJcbiAgICBCdWd6aWxsYS5wcm90b3R5cGUubWV0aG9kID0gbG9naW4oZnVuY3Rpb24ocGFyYW0sIHBhcmFtKSB7XHJcbiAgICB9KTtcclxuXHJcbkBwYXJhbSB7RnVuY3Rpb259IG1ldGhvZCB0byBkZWNvcmF0ZS5cclxuQHJldHVybiB7RnVuY3Rpb259IGRlY29yYXRlZCBtZXRob2QuXHJcbiovXHJcbmZ1bmN0aW9uIGxvZ2luUmVxdWlyZWQobWV0aG9kKSB7XHJcbiAgLy8gd2UgYXNzdW1lIHRoaXMgaXMgYSB2YWxpZCBidWdpbGxhIGluc3RhbmNlLlxyXG4gIHJldHVybiBmdW5jdGlvbigpIHtcclxuICAgIC8vIHJlbWVtYmVyIHx0aGlzfCBpcyBhIGJ1Z3ppbGxhIGluc3RhbmNlXHJcblxyXG4gICAgLy8gYXJncyBmb3IgdGhlIGRlY29yYXRlZCBtZXRob2RcclxuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSxcclxuICAgICAgICAvLyB3ZSBuZWVkIHRoZSBjYWxsYmFjayBzbyB3ZSBjYW4gcGFzcyBsb2dpbiByZWxhdGVkIGVycm9ycy5cclxuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcclxuXHJcbiAgICB0aGlzLmxvZ2luKGZ1bmN0aW9uKGVycikge1xyXG4gICAgICBpZiAoZXJyKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcclxuXHJcbiAgICAgIC8vIHdlIGFyZSBub3cgbG9nZ2VkIGluIHNvIHRoZSBtZXRob2QgY2FuIHJ1biFcclxuICAgICAgbWV0aG9kLmFwcGx5KHRoaXMsIGFyZ3MpO1xyXG4gICAgfS5iaW5kKHRoaXMpKTtcclxuICB9O1xyXG59XHJcblxyXG5leHBvcnQgdmFyIEJ1Z3ppbGxhQ2xpZW50ID0gY2xhc3Mge1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XHJcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuXHJcbiAgICB0aGlzLnVzZXJuYW1lID0gb3B0aW9ucy51c2VybmFtZTtcclxuICAgIHRoaXMucGFzc3dvcmQgPSBvcHRpb25zLnBhc3N3b3JkO1xyXG4gICAgdGhpcy50aW1lb3V0ID0gb3B0aW9ucy50aW1lb3V0IHx8IDA7XHJcblxyXG4gICAgaWYgKG9wdGlvbnMudGVzdCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29wdGlvbnMudGVzdCBpcyBkZXByZWNhdGVkIHBsZWFzZSBzcGVjaWZ5IHRoZSB1cmwgZGlyZWN0bHknKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmFwaVVybCA9IG9wdGlvbnMudXJsIHx8ICdodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Jlc3QvJztcclxuICAgIHRoaXMuYXBpVXJsID0gdGhpcy5hcGlVcmwucmVwbGFjZSgvXFwvJC8sIFwiXCIpO1xyXG5cclxuICAgIHRoaXMuX2F1dGggPSBudWxsO1xyXG4gIH1cclxuICAvKipcclxuICBBdXRoZW50aWNhdGlvbiBkZXRhaWxzIGZvciBnaXZlbiB1c2VyLlxyXG5cclxuICBFeGFtcGxlOlxyXG5cclxuICAgICAgeyBpZDogMTIyMiwgdG9rZW46ICd4eHh4JyB9XHJcblxyXG4gIEB0eXBlIHtPYmplY3R9XHJcbiAgKi9cclxuXHJcblxyXG4gIC8qKlxyXG4gIEluIHRoZSBSRVNUIEFQSSB3ZSBmaXJzdCBsb2dpbiB0byBhY3F1aXJlIGEgdG9rZW4gd2hpY2ggaXMgdGhlbiB1c2VkIHRvIG1ha2VcclxuICByZXF1ZXN0cy4gU2VlOiBodHRwOi8vYnpyLm1vemlsbGEub3JnL2Jtby80LjIvdmlldy9oZWFkOi9CdWd6aWxsYS9XZWJTZXJ2aWNlL1NlcnZlci9SRVNULnBtI0w1NTZcclxuXHJcbiAgVGhpcyBtZXRob2QgY2FuIGJlIHVzZWQgcHVibGljbHkgYnV0IGlzIGRlc2lnbmVkIGZvciBpbnRlcm5hbCBjb25zdW1wdGlvbiBmb3JcclxuICBlYXNlIG9mIHVzZS5cclxuXHJcbiAgQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgW0Vycm9yIGVyciwgU3RyaW5nIHRva2VuXS5cclxuICAqL1xyXG4gIGxvZ2luIChjYWxsYmFjaykge1xyXG5cclxuICAgIGlmICh0aGlzLl9hdXRoKSB7XHJcbiAgICAgIGNhbGxiYWNrKG51bGwsIHRoaXMuX2F1dGgpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy51c2VybmFtZSB8fCAhdGhpcy5wYXNzd29yZCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ21pc3Npbmcgb3IgaW52YWxpZCAudXNlcm5hbWUgb3IgLnBhc3N3b3JkJyk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHBhcmFtcyA9IHtcclxuICAgICAgbG9naW46IHRoaXMudXNlcm5hbWUsXHJcbiAgICAgIHBhc3N3b3JkOiB0aGlzLnBhc3N3b3JkXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBoYW5kbGVMb2dpbiA9IGZ1bmN0aW9uIGhhbmRsZUxvZ2luKGVyciwgcmVzcG9uc2UpIHtcclxuICAgICAgaWYgKGVycikgcmV0dXJuIGNhbGxiYWNrKGVycik7XHJcbiAgICAgIGlmIChyZXNwb25zZS5yZXN1bHQpIHtcclxuICAgICAgICB0aGlzLl9hdXRoID0gcmVzcG9uc2UucmVzdWx0XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgdGhpcy5fYXV0aCA9IHJlc3BvbnNlO1xyXG4gICAgICB9XHJcbiAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3BvbnNlKTtcclxuICAgIH0uYmluZCh0aGlzKTtcclxuXHJcbiAgICB0aGlzLkFQSVJlcXVlc3QoJy9sb2dpbicsICdHRVQnLCBoYW5kbGVMb2dpbiwgbnVsbCwgbnVsbCwgcGFyYW1zKTtcclxuICB9XHJcblxyXG4gIGdldEJ1ZyAoaWQsIHBhcmFtcywgY2FsbGJhY2spIHtcclxuICAgIC8vIGNvbnNvbGUubG9nKFwiYXJnc1wiLCBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cykpO1xyXG4gICAgaWYgKCFjYWxsYmFjaykge1xyXG4gICAgICAgY2FsbGJhY2sgPSBwYXJhbXM7XHJcbiAgICAgICBwYXJhbXMgPSB7fTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBjb25zb2xlLmxvZygnZ2V0QnVnPicsIGlkLCBwYXJhbXMsIGNhbGxiYWNrKTtcclxuXHJcbiAgICB0aGlzLkFQSVJlcXVlc3QoXHJcbiAgICAgICcvYnVnLycgKyBpZCxcclxuICAgICAgJ0dFVCcsXHJcbiAgICAgIGV4dHJhY3RGaWVsZChjYWxsYmFjayksXHJcbiAgICAgICdidWdzJyxcclxuICAgICAgbnVsbCxcclxuICAgICAgcGFyYW1zXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgc2VhcmNoQnVncyAocGFyYW1zLCBjYWxsYmFjaykge1xyXG4gICAgdGhpcy5BUElSZXF1ZXN0KCcvYnVnJywgJ0dFVCcsIGNhbGxiYWNrLCAnYnVncycsIG51bGwsIHBhcmFtcyk7XHJcbiAgfVxyXG5cclxuICB1cGRhdGVCdWcgKGlkLCBidWcsIGNhbGxiYWNrKSB7XHJcbiAgICB0aGlzLmxvZ2luICgoZXJyLCByZXNwb25zZSkgPT4ge1xyXG4gICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XHJcbiAgICAgIC8vIGNvbnNvbGUubG9nKFwidXBkYXRlQnVnPlwiLCByZXNwb25zZSk7XHJcbiAgICAgIHRoaXMuQVBJUmVxdWVzdCgnL2J1Zy8nICsgaWQsICdQVVQnLCBjYWxsYmFjaywgJ2J1Z3MnLCBidWcpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBjcmVhdGVCdWcgKGJ1ZywgY2FsbGJhY2spIHtcclxuICAgIHRoaXMuQVBJUmVxdWVzdCgnL2J1ZycsICdQT1NUJywgY2FsbGJhY2ssICdpZCcsIGJ1Zyk7XHJcbiAgfVxyXG5cclxuICBidWdDb21tZW50cyAoaWQsIGNhbGxiYWNrKSB7XHJcbiAgICByZXR1cm4gdGhpcy5idWdDb21tZW50c1NpbmNlKGlkLCBudWxsLCBjYWxsYmFjayk7XHJcbiAgfVxyXG5cclxuICBidWdDb21tZW50c1NpbmNlIChpZCwgZGF0ZSwgY2FsbGJhY2spIHtcclxuICAgIHZhciBfY2FsbGJhY2sgPSBmdW5jdGlvbihlLCByKSB7XHJcbiAgICAgIGlmIChlKSB0aHJvdyBlO1xyXG4gICAgICB2YXIgX2J1Z19jb21tZW50cyA9IHJbaWRdO1xyXG4gICAgICBpZiAodHlwZW9mIF9idWdfY29tbWVudHNbJ2NvbW1lbnRzJ10gIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgLy8gYnVnemlsbGEgNSA6KFxyXG4gICAgICAgIF9idWdfY29tbWVudHMgPSBfYnVnX2NvbW1lbnRzLmNvbW1lbnRzO1xyXG4gICAgICB9XHJcbiAgICAgIGNhbGxiYWNrKG51bGwsIF9idWdfY29tbWVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBwYXJhbXMgPSBkYXRlID8ge25ld19zaW5jZSA6IGRhdGV9IDogbnVsbDtcclxuXHJcbiAgICB0aGlzLkFQSVJlcXVlc3QoXHJcbiAgICAgICcvYnVnLycgKyBpZCArICcvY29tbWVudCcsXHJcbiAgICAgICdHRVQnLFxyXG4gICAgICBfY2FsbGJhY2ssXHJcbiAgICAgICdidWdzJyxcclxuICAgICAgbnVsbCxcclxuICAgICAgcGFyYW1zXHJcbiAgICApO1xyXG5cclxuICB9XHJcblxyXG4gIGFkZENvbW1lbnQgKGlkLCBjb21tZW50LCBjYWxsYmFjaykge1xyXG4gICAgdGhpcy5BUElSZXF1ZXN0KFxyXG4gICAgICAnL2J1Zy8nICsgaWQgKyAnL2NvbW1lbnQnLFxyXG4gICAgICAnUE9TVCcsXHJcbiAgICAgIGNhbGxiYWNrLFxyXG4gICAgICBudWxsLFxyXG4gICAgICBjb21tZW50XHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgYnVnSGlzdG9yeSAoaWQsIGNhbGxiYWNrKSB7XHJcbiAgICByZXR1cm4gdGhpcy5idWdIaXN0b3J5U2luY2UoaWQsIG51bGwsIGNhbGxiYWNrKTtcclxuICB9XHJcblxyXG4gIGJ1Z0hpc3RvcnlTaW5jZSAoaWQsIGRhdGUsIGNhbGxiYWNrKSB7XHJcbiAgICB2YXIgcGFyYW1zID0gZGF0ZSA/IHtuZXdfc2luY2UgOiBkYXRlfSA6IG51bGw7XHJcblxyXG4gICAgdGhpcy5BUElSZXF1ZXN0KFxyXG4gICAgICAnL2J1Zy8nICsgaWQgKyAnL2hpc3RvcnknLFxyXG4gICAgICAnR0VUJyxcclxuICAgICAgY2FsbGJhY2ssXHJcbiAgICAgICdidWdzJyxcclxuICAgICAgbnVsbCxcclxuICAgICAgcGFyYW1zXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmluZHMgYWxsIGF0dGFjaG1lbnRzIGZvciBhIGdpdmVuIGJ1ZyAjXHJcbiAgICogaHR0cDovL3d3dy5idWd6aWxsYS5vcmcvZG9jcy90aXAvZW4vaHRtbC9hcGkvQnVnemlsbGEvV2ViU2VydmljZS9CdWcuaHRtbCNhdHRhY2htZW50c1xyXG4gICAqXHJcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGlkIG9mIGJ1Zy5cclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbRXJyb3IsIEFycmF5PEF0dGFjaG1lbnQ+XS5cclxuICAgKi9cclxuICBidWdBdHRhY2htZW50cyAoaWQsIHBhcmFtcywgY2FsbGJhY2spIHtcclxuICAgIHRoaXMuQVBJUmVxdWVzdChcclxuICAgICAgJy9idWcvJyArIGlkICsgJy9hdHRhY2htZW50JyxcclxuICAgICAgJ0dFVCcsXHJcbiAgICAgIGV4dHJhY3RGaWVsZChpZCwgY2FsbGJhY2spLFxyXG4gICAgICAnYnVncycsXHJcbiAgICAgIG51bGwsXHJcbiAgICAgIHBhcmFtc1xyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIGNyZWF0ZUF0dGFjaG1lbnQgKGlkLCBhdHRhY2htZW50LCBjYWxsYmFjaykge1xyXG4gICAgdGhpcy5BUElSZXF1ZXN0KFxyXG4gICAgICAnL2J1Zy8nICsgaWQgKyAnL2F0dGFjaG1lbnQnLFxyXG4gICAgICAnUE9TVCcsXHJcbiAgICAgIGV4dHJhY3RGaWVsZChjYWxsYmFjayksXHJcbiAgICAgICdpZHMnLFxyXG4gICAgICBhdHRhY2htZW50XHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgZ2V0QXR0YWNobWVudCAoaWQsIGNhbGxiYWNrKSB7XHJcbiAgICB0aGlzLkFQSVJlcXVlc3QoXHJcbiAgICAgICcvYnVnL2F0dGFjaG1lbnQvJyArIGlkLFxyXG4gICAgICAnR0VUJyxcclxuICAgICAgZXh0cmFjdEZpZWxkKGNhbGxiYWNrKSxcclxuICAgICAgJ2F0dGFjaG1lbnRzJ1xyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHVwZGF0ZUF0dGFjaG1lbnQgKGlkLCBhdHRhY2htZW50LCBjYWxsYmFjaykge1xyXG4gICAgdGhpcy5BUElSZXF1ZXN0KCcvYnVnL2F0dGFjaG1lbnQvJyArIGlkLCAnUFVUJywgY2FsbGJhY2ssICdvaycsIGF0dGFjaG1lbnQpO1xyXG4gIH1cclxuXHJcbiAgc2VhcmNoVXNlcnMgKG1hdGNoLCBjYWxsYmFjaykge1xyXG4gICAgdGhpcy5BUElSZXF1ZXN0KCcvdXNlcicsICdHRVQnLCBjYWxsYmFjaywgJ3VzZXJzJywgbnVsbCwge21hdGNoOiBtYXRjaH0pO1xyXG4gIH1cclxuXHJcbiAgZ2V0VXNlciAoaWQsIGNhbGxiYWNrKSB7XHJcbiAgICB0aGlzLkFQSVJlcXVlc3QoXHJcbiAgICAgICcvdXNlci8nICsgaWQsXHJcbiAgICAgICdHRVQnLFxyXG4gICAgICBleHRyYWN0RmllbGQoY2FsbGJhY2spLFxyXG4gICAgICAndXNlcnMnXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgZ2V0U3VnZ2VzdGVkUmV2aWV3ZXJzIChpZCwgY2FsbGJhY2spIHtcclxuICAgIC8vIEJNTy0gc3BlY2lmaWMgZXh0ZW5zaW9uIHRvIGdldCBzdWdnZXN0ZWQgcmV2aWV3ZXJzIGZvciBhIGdpdmVuIGJ1Z1xyXG4gICAgLy8gaHR0cDovL2J6ci5tb3ppbGxhLm9yZy9ibW8vNC4yL3ZpZXcvaGVhZDovZXh0ZW5zaW9ucy9SZXZpZXcvbGliL1dlYlNlcnZpY2UucG0jTDEwMlxyXG4gICAgdGhpcy5BUElSZXF1ZXN0KCcvcmV2aWV3L3N1Z2dlc3Rpb25zLycgKyBpZCwgJ0dFVCcsIGNhbGxiYWNrKTtcclxuICB9XHJcblxyXG4gIC8qXHJcbiAgICBYWFggdGhpcyBjYWxsIGlzIHByb3ZpZGVkIGZvciBjb252ZW5pZW5jZSB0byBwZW9wbGUgc2NyaXB0aW5nIGFnYWluc3QgcHJvZCBidWd6aWxscVxyXG4gICAgVEhFUkUgSVMgTk8gRVFVSVZBTEVOVCBSRVNUIENBTEwgSU4gVElQLCBzbyB0aGlzIHNob3VsZCBub3QgYmUgdGVzdGVkIGFnYWluc3QgdGlwLCBoZW5jZVxyXG4gICAgdGhlIGhhcmQtY29kZWQgdXJsLlxyXG4gICovXHJcbiAgZ2V0Q29uZmlndXJhdGlvbiAocGFyYW1zLCBjYWxsYmFjaykge1xyXG4gICAgaWYgKCFjYWxsYmFjaykge1xyXG4gICAgICAgY2FsbGJhY2sgPSBwYXJhbXM7XHJcbiAgICAgICBwYXJhbXMgPSB7fTtcclxuICAgIH1cclxuXHJcbiAgICAvLyB0aGlzLkFQSVJlcXVlc3QoJy9jb25maWd1cmF0aW9uJywgJ0dFVCcsIGNhbGxiYWNrLCBudWxsLCBudWxsLCBwYXJhbXMpO1xyXG4gICAgLy8gVUdMQVkgdGVtcCBmaXggdW50aWwgL2NvbmZpZ3VyYXRpb24gaXMgaW1wbGVtZW50ZWQsXHJcbiAgICAvLyBzZWUgaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9OTI0NDA1I2MxMTpcclxuICAgIGxldCB0aGF0ID0gdGhpcztcclxuXHJcbiAgICB2YXIgcmVxID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICByZXEub3BlbignR0VUJywgJ2h0dHBzOi8vYXBpLWRldi5idWd6aWxsYS5tb3ppbGxhLm9yZy9sYXRlc3QvY29uZmlndXJhdGlvbicsIHRydWUpO1xyXG4gICAgcmVxLnNldFJlcXVlc3RIZWFkZXIoXCJBY2NlcHRcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgcmVxLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICBpZiAocmVxLnJlYWR5U3RhdGUgPT0gNCAmJiByZXEuc3RhdHVzICE9IDApIHtcclxuICAgICAgICB0aGF0LmhhbmRsZVJlc3BvbnNlKG51bGwsIHJlcSwgY2FsbGJhY2spO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgcmVxLnRpbWVvdXQgPSB0aGlzLnRpbWVvdXQ7XHJcbiAgICByZXEub250aW1lb3V0ID0gZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgIHRoYXQuaGFuZGxlUmVzcG9uc2UoJ3RpbWVvdXQnLCByZXEsIGNhbGxiYWNrKTtcclxuICAgIH07XHJcbiAgICByZXEub25lcnJvciA9IGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICB0aGF0LmhhbmRsZVJlc3BvbnNlKCdlcnJvcicsIHJlcSwgY2FsbGJhY2spO1xyXG4gICAgfTtcclxuICAgIHJlcS5zZW5kKCk7XHJcbiAgfVxyXG5cclxuICBBUElSZXF1ZXN0IChwYXRoLCBtZXRob2QsIGNhbGxiYWNrLCBmaWVsZCwgYm9keSwgcGFyYW1zKSB7XHJcbiAgICBpZiAoXHJcbiAgICAgIC8vIGlmIHdlIGFyZSBkb2luZyB0aGUgbG9naW5cclxuICAgICAgcGF0aCA9PT0gTE9HSU4gfHxcclxuICAgICAgLy8gaWYgd2UgYXJlIGFscmVhZHkgYXV0aGVkXHJcbiAgICAgIHRoaXMuX2F1dGggfHxcclxuICAgICAgLy8gb3Igd2UgYXJlIG1pc3NpbmcgYXV0aCBkYXRhXHJcbiAgICAgICF0aGlzLnBhc3N3b3JkIHx8ICF0aGlzLnVzZXJuYW1lXHJcbiAgICApIHtcclxuICAgICAgLy8gc2tpcCBhdXRvbWF0aWMgYXV0aGVudGljYXRpb25cclxuICAgICAgcmV0dXJuIHRoaXMuX0FQSVJlcXVlc3QuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBzbyB3ZSBjYW4gcGFzcyB0aGUgYXJndW1lbnRzIGluc2lkZSBvZiBhbm90aGVyIGZ1bmN0aW9uXHJcbiAgICBsZXQgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcclxuXHJcbiAgICB0aGlzLmxvZ2luKGZ1bmN0aW9uKGVycikge1xyXG4gICAgICBpZiAoZXJyKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcclxuICAgICAgdGhpcy5fQVBJUmVxdWVzdC5hcHBseSh0aGlzLCBhcmdzKTtcclxuICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgfVxyXG5cclxuICBfQVBJUmVxdWVzdCAocGF0aCwgbWV0aG9kLCBjYWxsYmFjaywgZmllbGQsIGJvZHksIHBhcmFtcykge1xyXG4gICAgbGV0IHVybCA9IHRoaXMuYXBpVXJsICsgcGF0aDtcclxuXHJcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwge307XHJcblxyXG4gICAgaWYgKHRoaXMuX2F1dGgpIHtcclxuICAgICAgcGFyYW1zLnRva2VuID0gdGhpcy5fYXV0aC50b2tlbjtcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKHRoaXMudXNlcm5hbWUgJiYgdGhpcy5wYXNzd29yZCkge1xyXG4gICAgICBwYXJhbXMudXNlcm5hbWUgPSB0aGlzLnVzZXJuYW1lO1xyXG4gICAgICBwYXJhbXMucGFzc3dvcmQgPSB0aGlzLnBhc3N3b3JkO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChwYXJhbXMgJiYgT2JqZWN0LmtleXMocGFyYW1zKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHVybCArPSBcIj9cIiArIHRoaXMudXJsRW5jb2RlKHBhcmFtcyk7XHJcbiAgICB9XHJcblxyXG4gICAgYm9keSA9IEpTT04uc3RyaW5naWZ5KGJvZHkpO1xyXG5cclxuICAgIGxldCB0aGF0ID0gdGhpcztcclxuXHJcbiAgICB2YXIgcmVxID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICByZXEub3BlbihtZXRob2QsIHVybCwgdHJ1ZSk7XHJcbiAgICByZXEuc2V0UmVxdWVzdEhlYWRlcihcIkFjY2VwdFwiLCBcImFwcGxpY2F0aW9uL2pzb25cIik7XHJcbiAgICBpZiAobWV0aG9kLnRvVXBwZXJDYXNlKCkgIT09IFwiR0VUXCIpIHtcclxuICAgICAgcmVxLnNldFJlcXVlc3RIZWFkZXIoXCJDb250ZW50LVR5cGVcIiwgXCJhcHBsaWNhdGlvbi9qc29uXCIpO1xyXG4gICAgfVxyXG4gICAgcmVxLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICBpZiAocmVxLnJlYWR5U3RhdGUgPT0gNCAmJiByZXEuc3RhdHVzICE9IDApIHtcclxuICAgICAgICB0aGF0LmhhbmRsZVJlc3BvbnNlKG51bGwsIHJlcSwgY2FsbGJhY2ssIGZpZWxkKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIHJlcS50aW1lb3V0ID0gdGhpcy50aW1lb3V0O1xyXG4gICAgcmVxLm9udGltZW91dCA9IGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICB0aGF0LmhhbmRsZVJlc3BvbnNlKCd0aW1lb3V0JywgcmVxLCBjYWxsYmFjayk7XHJcbiAgICB9O1xyXG4gICAgcmVxLm9uZXJyb3IgPSBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgdGhhdC5oYW5kbGVSZXNwb25zZShldmVudCwgcmVxLCBjYWxsYmFjayk7XHJcbiAgICB9O1xyXG4gICAgcmVxLnNlbmQoYm9keSk7XHJcbiAgfVxyXG5cclxuICBoYW5kbGVSZXNwb25zZSAoZXJyLCByZXNwb25zZSwgY2FsbGJhY2ssIGZpZWxkKSB7XHJcbiAgICAvLyBkZXRlY3QgdGltZW91dCBlcnJvcnNcclxuICAgIGlmIChlcnIgJiYgZXJyLmNvZGUgJiYgVElNRU9VVF9FUlJPUlMuaW5kZXhPZihlcnIuY29kZSkgIT09IC0xKSB7XHJcbiAgICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ3RpbWVvdXQnKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gaGFuZGxlIGdlbmVyaWMgZXJyb3JzXHJcbiAgICBpZiAoZXJyKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcclxuXHJcbiAgICAvLyBhbnl0aGluZyBpbiAyMDAgc3RhdHVzIHJhbmdlIGlzIGEgc3VjY2Vzc1xyXG4gICAgdmFyIHJlcXVlc3RTdWNjZXNzZnVsID0gcmVzcG9uc2Uuc3RhdHVzID4gMTk5ICYmIHJlc3BvbnNlLnN0YXR1cyA8IDMwMDtcclxuXHJcbiAgICAvLyBldmVuIGluIHRoZSBjYXNlIG9mIGFuIHVuc3VjY2Vzc2Z1bCByZXF1ZXN0IHdlIG1heSBoYXZlIGpzb24gZGF0YS5cclxuICAgIHZhciBwYXJzZWRCb2R5O1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIHBhcnNlZEJvZHkgPSBKU09OLnBhcnNlKHJlc3BvbnNlLnJlc3BvbnNlVGV4dCk7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIC8vIFhYWDogbWlnaHQgd2FudCB0byBoYW5kbGUgdGhpcyBiZXR0ZXIgaW4gdGhlIHJlcXVlc3Qgc3VjY2VzcyBjYXNlP1xyXG4gICAgICBpZiAocmVxdWVzdFN1Y2Nlc3NmdWwpIHtcclxuICAgICAgICByZXR1cm4gY2FsbGJhY2soXHJcbiAgICAgICAgICBuZXcgRXJyb3IoJ3Jlc3BvbnNlIHdhcyBub3QgdmFsaWQganNvbjogJyArIHJlc3BvbnNlLnJlc3BvbnNlVGV4dClcclxuICAgICAgICApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gZGV0ZWN0IGlmIHdlJ3JlIHJ1bm5pbmcgQnVnemlsbGEgNS4wXHJcbiAgICBpZiAodHlwZW9mIHBhcnNlZEJvZHlbJ3Jlc3VsdCddICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICBwYXJzZWRCb2R5ID0gcGFyc2VkQm9keVsncmVzdWx0J107XHJcbiAgICB9XHJcblxyXG4gICAgLy8gc3VjY2Vzc2Z1bCBodHRwIHJlc3Buc2UgYnV0IGFuIGVycm9yXHJcbiAgICAvLyBYWFg6IHRoaXMgc2VlbXMgbGlrZSBhIGJ1ZyBpbiB0aGUgYXBpLlxyXG4gICAgaWYgKHBhcnNlZEJvZHkgJiYgcGFyc2VkQm9keS5lcnJvcikge1xyXG4gICAgICByZXF1ZXN0U3VjY2Vzc2Z1bCA9IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghcmVxdWVzdFN1Y2Nlc3NmdWwpIHtcclxuICAgICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcihcclxuICAgICAgICAnSFRUUCBzdGF0dXMgJyArIHJlc3BvbnNlLnN0YXR1cyArICdcXG4nICtcclxuICAgICAgICAvLyBub3RlIGludGVudGlvbmFsIHVzZSBvZiAhPSBpbnN0ZWFkIG9mICE9PVxyXG4gICAgICAgIChwYXJzZWRCb2R5ICYmIHBhcnNlZEJvZHkubWVzc2FnZSkgPyBwYXJzZWRCb2R5Lm1lc3NhZ2UgOiAnJ1xyXG4gICAgICApKTtcclxuICAgIH1cclxuXHJcbiAgICBjYWxsYmFjayhudWxsLCAoZmllbGQpID8gcGFyc2VkQm9keVtmaWVsZF0gOiBwYXJzZWRCb2R5KTtcclxuICB9XHJcblxyXG4gIHVybEVuY29kZSAocGFyYW1zKSB7XHJcbiAgICB2YXIgdXJsID0gW107XHJcbiAgICBmb3IodmFyIHBhcmFtIGluIHBhcmFtcykge1xyXG4gICAgICB2YXIgdmFsdWVzID0gcGFyYW1zW3BhcmFtXTtcclxuICAgICAgaWYoIXZhbHVlcy5mb3JFYWNoKVxyXG4gICAgICAgIHZhbHVlcyA9IFt2YWx1ZXNdO1xyXG4gICAgICAvLyBleHBhbmQgYW55IGFycmF5c1xyXG4gICAgICB2YWx1ZXMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgICB1cmwucHVzaChlbmNvZGVVUklDb21wb25lbnQocGFyYW0pICsgXCI9XCIgK1xyXG4gICAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIHJldHVybiB1cmwuam9pbihcIiZcIik7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2xpZW50KG9wdGlvbnMpIHtcclxuICByZXR1cm4gbmV3IEJ1Z3ppbGxhQ2xpZW50KG9wdGlvbnMpO1xyXG59XHJcbiIsImV4cG9ydCB2YXIgWE1MSHR0cFJlcXVlc3QgPSBudWxsO1xyXG5cclxuaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgLy8gd2UncmUgbm90IGluIGEgYnJvd3Nlcj9cclxuICBsZXQgX2xvYWRlciA9IHJlcXVpcmU7XHJcbiAgdHJ5IHtcclxuICAgIFhNTEh0dHBSZXF1ZXN0ID0gX2xvYWRlcignc2RrL25ldC94aHInKS5YTUxIdHRwUmVxdWVzdDtcclxuICB9IGNhdGNoKGUpIHtcclxuICAgIFhNTEh0dHBSZXF1ZXN0ID0gX2xvYWRlcihcInhtbGh0dHByZXF1ZXN0XCIpLlhNTEh0dHBSZXF1ZXN0O1xyXG4gIH1cclxufVxyXG5lbHNlIGlmKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiB3aW5kb3cuWE1MSHR0cFJlcXVlc3QgIT09ICd1bmRlZmluZWQnKSB7XHJcbiAgWE1MSHR0cFJlcXVlc3QgPSB3aW5kb3cuWE1MSHR0cFJlcXVlc3Q7XHJcbn1cclxuZWxzZSB7XHJcbiAgdGhyb3cgXCJObyB3aW5kb3csIFdBVC5cIlxyXG59XHJcblxyXG4iXX0=
