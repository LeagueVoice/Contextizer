"use strict";

/**
 * Contextizer: context injection.
 * Like dependency injection but done per-request.
 * With new inputs every time.
 *
 * See test.js for example usage.
 */
function Contextizer() {
  this.graph = {};
}

Contextizer.prototype = {
  register(path) {
    if (this.graph[path])
      throw new Error(`Path "${name}" already registered with value ${JSON.stringify(this.graph[path])}.`);
    return {
      asInput: () => this.graph[path] = { type: 'input' },
      asConstant: value => this.graph[path] = { type: 'constant', value },
      asFunction: ({ deps, func, cleanup=null, params={}, cached=false }) =>
        this.graph[path] = { type: 'function', deps, func, cleanup, params, cached }
    };
  },
  execute(target, inputs={}) {
    if (!this.graph[target])
      throw new Error(`Target "${target}" not found.`);
    let context = {};
    let ordering = this._traverse(target);
    ordering.forEach(([ name, deps ]) => {
      let item = this.graph[name];
      switch(item.type) {
        case 'input':
          if (!inputs.hasOwnProperty(name))
            throw new Error(`Missing input ${name}.`);
          context[name] = inputs[name];
          break;
        case 'constant':
          context[name] = item.value;
          break;
        case 'function':
          let arg = this._makeArg(context, item, deps);
          context[name] = promiseProps(arg)
            .then(item.func);
          if (item.cached) // If cached function, convert to constant.
            this.graph[name] = { type: 'constant', value: context[name] };
          break;
      }
    });
    ordering.reverse(); // In-place.
    let cleanup = () => {
      ordering.forEach(([ name, deps ]) => {
        let item = this.graph[name];
        if (!item.cleanup)
          return;
        let arg = this._makeArg(context, item, deps);
        arg.$value = context[name];
        // Block any errors to allow cleanup even if error happened.
        Object.entries(arg).forEach(([ key, value ]) => arg[key] =
          value instanceof Promise ? value.catch(e => null) : value);
        // Execute cleanup.
        promiseProps(arg)
          .then(item.cleanup)
          .catch(e => console.error(`Item "${name}" threw error during cleanup:`, e));
      });
    };
    context[target].then(cleanup, cleanup);
    return context[target];
  },
  // PRIVATE HELPER METHODS
  _makeArg(context, item, deps) {
    let arg = {};
    Object.assign(arg, item.params);
    // item.deps may be shorthand, this renames the context's canonical names correctly.
    item.deps.forEach((depName, i) => arg[depName] = context[deps[i]]);
    return arg;
  },
  /* Topological sort, via post-order traversal. */
  _traverse(target) {
    let result = new Map();
    let visited = new Set();
    let path = new Set();
    let visit = name => {
      visited.add(name);
      path.add(name);
      let deps = this._deps(name);
      deps.forEach(dep => {
        if (!visited.has(dep))
          visit(dep);
        else if (path.has(dep)) {
          let cycle = Array.from(path);
          cycle.push(dep);
          throw new Error('Dependency Cycle Found: ' + cycle.join(' -> '));
        }
      });
      path.delete(name);
      if (!result.has(name))
        result.set(name, deps);
    };
    visit(target);
    return Array.from(result.entries());
  },
  _deps(path) {
    let item = this.graph[path];
    if (!item)
      throw new Error(`Missing dependency: "${path}".`);
    if (!item.deps)
      return [];
    let namespaces = path.split('.');
    return item.deps.map(dep => {
      if (dep.includes('.')) { // Canonical dep path.
        if ('.' === dep.charAt(0))
          return dep.slice(1);
        return dep;
      }
      // Search for dep, starting from most specific namespace.
      for (let i = namespaces.length - 1; i >= 0; i--) {
        let canonical = namespaces.slice(0, i).concat(dep).join('.');
        if (canonical === path)
          continue; // Don't let it depend on itself.
        if (this.graph[canonical])
          return canonical;
      }
      throw new Error(`Dependency "${dep}" not found for item ${path}.`);
    });
  }
};

const promiseProps = Promise.props || function(obj) {
  let keys = Object.keys(obj);
  return Promise.all(Object.values(obj))
    .then(vals => {
      let result = {};
      vals.forEach((val, i) => result[keys[i]] = val);
      return result;
    });
};

module.exports = Contextizer;
