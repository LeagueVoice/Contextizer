# Contextizer

Contextizer is a transient context injection system. Contextizer simplifies
complex multi-stage, pipeline, and/or promise-based code, and makes unit testing
a breeze. It performs a
role similar to [Express](https://expressjs.com/)'s middleware system, but in
a declarative dependency-injection-like style.

Inputs are what make Contextizer different from a normal dependency injection system.
While normal dependency injection systems are made to initialize a program, Contextizer
is designed to be used with varying inputs many times during a program's runtime.

## Usage

To install to your project, use `npm install --save contextizer`.

Below is a contrived of a simple context. It has an input value `a`, some goals
that calculate information about `a` and a constant `b`, and a final goal that
prints out the information.

```js
const Contextizer = require('contextizer');

let context = new Contextizer();

context.register('a').asInput();
context.register('b').asConstant(5);
context.register('sum').asFunction({
  deps: [ 'a', 'b' ], // dependencies.
  func({ a, b }) {
    return a + b;
  }
});
context.register('product').asFunction({
  deps: [ 'a', 'b' ],
  func({ a, b }) {
    return a * b;
  }
});
context.register('info').asFunction({
  deps: [ 'sum', 'product' ],
  func({ sum, product }) {
    console.log(`The sum of a and b is ${sum}.`);
    console.log(`The product of a and b is ${product}.`);
  }
});

// Execute 'info' with input a = 4.
context.execute('info', { a: 4 });
// "The sum of a and b is 9."
// "The product of a and b is 20."
```

This example shows all three types of objects that can be registered.

### Inputs

Inputs are what makes Contextizer different from dependency injection.
Inputs are not defined at registration time. Instead, they are passed in at every execution.

```js
context.register('inputName').asInput();
```

### Constants

Constants are constant values that do not change across multiple executions.
Constants may be values or promises.

```js
// Register value.
context.register('pi').asConstant(Math.PI);

// Register promise.
const req = require('request-promise-native'); // https://github.com/request/request-promise-native
context.register('robots').asConstant(req('https://www.google.com/robots.txt'));
```

### Functions

Functions are where the good stuff happens. Functions can depend on inputs, constants,
or other functions.

The `.asFunction(arg)` method takes in a single `arg` object. The object has the following properties:
- `deps` (REQUIRED) - List of dependencies (string array).
- `func` (REQUIRED) - The function. Dependencies are passed in as a single argument object, so
using the es6 destructuring assigment syntax is recommended. This may return a value or a promise.
- `cleanup` (optional) - A function that is called after the execution completes, in order to clean up resources.
This callback receives the same argument object as `func` with an additional `$value` property for the object
returned by `func`. This may be called even if `func` hasn't been, due to upstream thrown exceptions. Note that
this may not execute immediately so it is not reliable to change `params` here.
- `cached` (optional, default false) - Boolean. If true, this function will only be executed once, then the value
will be saved permanently. Use with care.
- `params` (optional) - Object, for holding state object. These parameters will always be passed in to `func` so
they can be used to hold state across calls.

```js
context.register('sum').asFunction({
  deps: [ 'a', 'b' ], // Dependencies, registration not shown in this example.
  func({ a, b }) {
    return a + b;
  }
});

// Fibonacci sequence using params.
context.register('fib').asFunction({
  deps: [], // No dependencies.
  func({ vals }) { // `vals` from params.
    vals.push(vals[0] + vals[1]);
    return vals.shift();
  },
  params: {
    vals: [ 1, 1 ]
  }
});
```

## Namespaces

For organizational purposes, objects can be registered in nested namespaces.
Think of this like Java packages.

When resolving dependencies, Contextizer will start in the current namespace and move up
to the global namespace. Alternatively, absolute paths can be used.

A dot prefix can be used to make a dependency path absolute.

```js
context.register('value').asConstant(10);
context.register('package.value').asConstant(20);
context.register('package.func').asFunction({
  deps: [ 'value' ],
  func({ value }) {
    // value === 20 because `func` is in the same namespace as `package.value`.
  }
});
context.register('package.func2').asFunction({
  deps: [ '.value' ],
  func({ '.value': value }) {
    // value === 10 because '.value' is considered an absolute path.
  }
});
```
