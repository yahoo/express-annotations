/*
Copyright (c) 2013, Yahoo! Inc. All rights reserved.
Copyrights licensed under the New BSD License.
See the accompanying LICENSE file for terms.
*/

'use strict';

var methods = require('methods');

exports.extend = extendObject;

function extendObject(object) {
    if (object['@annotations']) { return object; }

    // Brand.
    Object.defineProperty(object, '@annotations', {value: true});

    // Modifies the Express `app` or router by adding the 
    // `annotate()` and `findAll()` methods.
    object.annotations = {};
    object.annotate    = annotate;
    object.findAll     = findAll;

    return object;
}

function annotate(routePath, annotations) {
    /* jshint validthis:true */
    if (typeof routePath !== 'string') {
        throw new TypeError('Annotations require routePath to be a String');
    }

    var pathAnnotations = this.annotations[routePath] ||
            (this.annotations[routePath] = {});

    extend(pathAnnotations, annotations);
    return this;
}

function findAll(annotations) {
    /* jshint validthis:true */

    // Support a function, single array of annotations, or var-args.
    if (!(typeof annotations === 'function' || Array.isArray(annotations))) {
        annotations = [].slice.call(arguments);
    }

    var appAnnotations = this.annotations,
        routes         = this.routes || this.stack || (this._router && this._router.stack);

    // Iterate all the app's routes, and return a reduced set based on the
    // specified `annotations`.
    if (Array.isArray(routes)) {
        return filterExpressRoutes(appAnnotations, annotations, routes);
    } else if (typeof routes == 'object' && routes !== null) {
        return filterLegacyExpressRoutes(appAnnotations, annotations, routes);
    } else {
        return {};
    }
}

// -- Helper Functions ---------------------------------------------------------

function filterExpressRoutes(appAnnotations, annotations, routes) {
    // Express 4.x has routes in an array (stack), rather than
    // keyed of by their HTTP method.
    var matches = routes.filter(function (stackHandler) {
        var route = stackHandler.route,
            pathAnnotations;

        pathAnnotations = route && typeof route.path === 'string' &&
            appAnnotations[route.path];

        return hasAnnotations(pathAnnotations, annotations);
    });

    return matches.reduce(function (map, match) {
        var stackRoute = match.route,
            stack = stackRoute && stackRoute.stack,
            route = {
                path  : stackRoute.path,
                keys  : match.keys,
                regexp: match.regexp
            };

        // If this is a generic route added through `router.route()`
        // or through `router.VERB()`.
        if (stack && Array.isArray(stack)) {
            stack.map(function (stackItem) {
                var method = stackItem.method;

                map[method] = map[method] || [];
                route.method = method;

                map[method].push(route); 
            });
        // If this is a route added through `router.all()`
        } else if (stack && typeof(stack) === 'function') {
            methods.map(function (method) {
                map[method] = map[method] || [];
                route.method = method;

                map[method].push(route);
            });
        }

        return map;
    }, {});
}

function filterLegacyExpressRoutes(appAnnotations, annotations, routes) {
    // Routes in Express 3.x are an object keyed off of the HTTP method 
    return Object.keys(routes).reduce(function (map, method) {
        var matches = routes[method].filter(function (route) {
            var pathAnnotations = typeof route.path === 'string' &&
                    appAnnotations[route.path];

            return hasAnnotations(pathAnnotations, annotations);
        });

        if (matches.length) {
            map[method] = matches;
        }

        return map;
    }, {});
}


function hasAnnotations(pathAnnotations, annotations) {
    if (!pathAnnotations) { return false; }

    // A function can be supplied instead of a collection of annotations, and in
    // that case it's called and it return value is coerced into a boolean and
    // returned.
    if (typeof annotations === 'function') {
        return !!annotations(pathAnnotations);
    }

    // Annotations are specified as either a string name, or object of
    // name-value pairs.
    return annotations.every(function (annotation) {
        // Only an annotation name was provided, no value, so if the path has an
        // annotation property with that name, count it!
        if (typeof annotation === 'string') {
            return pathAnnotations.hasOwnProperty(annotation);
        }

        // Annotation is an object of name-value pairs, so all values need to
        // match the path's annotations for it to be counted.
        return Object.keys(annotation).every(function (name) {
            return pathAnnotations[name] === annotation[name];
        });
    });
}

function extend(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function (source) {
        if (!source) { return; }

        for (var key in source) {
            obj[key] = source[key];
        }
    });

    return obj;
}
