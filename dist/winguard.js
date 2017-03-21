// Author: Jesús Bejarano
// TODO
// Polish code, so much boilerplate.
var Winguard;
(function (Winguard) {
    const setState = (context, transition) => {
        context.currentState = transition(context.currentState);
    };
    const nextEffect = (context, arr) => {
        function recur(st) {
            if (st !== undefined) {
                context.currentState = st;
            }
            if (!arr.length) {
                return;
            }
            let x = arr.pop()(context.currentState);
            if (typeof x !== "function") {
                return recur(st);
            }
            else {
                return x(recur);
            }
        }
        recur();
    };
    class Guard {
        constructor(initialState, observe) {
            this.initialState = initialState;
            this.currentState = initialState();
            this.observe = observe;
            this.registry = new Map();
        }
        defineRules(schema, acc = []) {
            let names = Object.keys(schema);
            if (!names.length) {
                return acc;
            }
            for (let name of names) {
                let rule = Reflect.get(schema, name);
                if (typeof rule === "object") {
                    return this.defineRules(rule, acc);
                }
                else {
                    let r = this.defineRule(name, rule);
                    acc.push(rule);
                }
            }
            return acc;
        }
        defineRule(name, pred) {
            if (typeof name !== "string") {
                throw Error(`Expeting argument "name" to be a string. Given: ${name}`);
            }
            if (typeof pred !== "function") {
                throw Error(`Expeting argument "pred" to be a function. Given: ${pred}`);
            }
            this.registry.set(name, pred);
            return (state, args) => {
                let r = pred(state);
                if (this.observe !== undefined) {
                    this.observe({
                        name: name,
                        result: r,
                        state: state,
                        args: args,
                    });
                }
                return r;
            };
        }
        effect(fn, rule) {
            return (state, args) => {
                let r = false;
                if (rule === undefined) {
                    r = true;
                }
                else {
                    let r = rule(state, args);
                }
                if (r) {
                    this.effects.push((state, args) => {
                        if (this.observe !== undefined) {
                            this.observe({
                                name: "effect",
                                result: r,
                                state: state,
                                args: args,
                            });
                        }
                        return fn(state, args);
                    });
                }
                return r;
            };
        }
        apply(rulename, args) {
            let rule = this.registry.get(rulename);
            if (!rule) {
                throw Error(`Undefined rulename: ${rulename}`);
            }
            let effs = this.effects;
            rule(this.currentState, args);
            return Promise.resolve()
                .then(() => effs.length && nextEffect(this, effs))
                .then(() => this.currentState);
        }
        select(...rules) {
            return (state, args) => {
                for (let rule of rules) {
                    if (typeof rule === "string") {
                        let rulename = rule;
                        rule = this.registry.get(rulename);
                        if (!rule === undefined) {
                            throw Error(`Undefined rulename: ${rulename}`);
                        }
                    }
                    let r = rule(state, args);
                    if (r) {
                        if (this.observe !== undefined) {
                            this.observe({
                                name: "select",
                                result: r,
                                state: state,
                                args: args,
                            });
                        }
                        return true;
                    }
                }
                if (this.observe !== undefined) {
                    this.observe({
                        name: "select",
                        result: false,
                        state: state,
                        args: args,
                    });
                }
                return false;
            };
        }
        some(...rules) {
            return (state, args) => {
                let r = false;
                for (let rule of rules) {
                    if (typeof rule === "string") {
                        let rulename = rule;
                        rule = this.registry.get(rulename);
                        if (!rule === undefined) {
                            throw Error(`Undefined rulename: ${rulename}`);
                        }
                    }
                    r = rule(state);
                    if (r) {
                        r = true;
                    }
                }
                if (this.observe !== undefined) {
                    this.observe({
                        name: "some",
                        result: r,
                        state: state,
                        args: args,
                    });
                }
                return r;
            };
        }
        every(...rules) {
            return (state, args) => {
                let r = false;
                for (let rule of rules) {
                    if (typeof rule === "string") {
                        let rulename = rule;
                        rule = this.registry.get(rulename);
                        if (!rule === undefined) {
                            throw Error(`Undefined rulename: ${rulename}`);
                        }
                    }
                    r = rule(state, args);
                    if (!r) {
                        break;
                    }
                }
                if (this.observe !== undefined) {
                    this.observe({
                        name: "every",
                        result: r,
                        state: state,
                        args: args,
                    });
                }
                return r;
            };
        }
        ;
        optional(rule1, rule2) {
            return (state, args) => {
                if (typeof rule1 === "string") {
                    let rulename = rule1;
                    rule1 = this.registry.get(rulename);
                    if (!rule1 === undefined) {
                        throw Error(`Undefined rulename: ${rulename}`);
                    }
                }
                if (typeof rule2 === "string") {
                    let rulename = rule2;
                    rule2 = this.registry.get(rulename);
                    if (!rule2 === undefined) {
                        throw Error(`Undefined rulename: ${rulename}`);
                    }
                }
                return this.select(rule1, this.always(rule2))(state, args);
            };
        }
        not(rule) {
            return (state, args) => {
                if (typeof rule === "string") {
                    let rulename = rule;
                    rule = this.registry.get(rulename);
                    if (!rule === undefined) {
                        throw Error(`Undefined rulename: ${rulename}`);
                    }
                }
                let r = !rule(state);
                if (this.observe !== undefined) {
                    this.observe({
                        name: "not",
                        result: r,
                        state: state,
                        args: args,
                    });
                }
                return r;
            };
        }
        ;
        always(rule) {
            return (state, args) => {
                if (typeof rule === "string") {
                    let rulename = rule;
                    rule = this.registry.get(rulename);
                    if (!rule === undefined) {
                        throw Error(`Undefined rulename: ${rulename}`);
                    }
                }
                rule(state, args);
                if (this.observe !== undefined) {
                    this.observe({
                        name: "always",
                        result: true,
                        state: state,
                        args: args,
                    });
                }
                return true;
            };
        }
        ;
    }
})(Winguard || (Winguard = {}));
//# sourceMappingURL=winguard.js.map