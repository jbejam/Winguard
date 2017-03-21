// Author: Jesús Bejarano


// TODO
// Polish code, so much boilerplate.
namespace Winguard {
	export type Recorder = (name: string, succeded: boolean) => void;
	export type Schema<KS extends string, ST> = {[K in keyof KS]: Rule<ST>}
	export type Predicate<ST> = (state: Readonly<ST>) => boolean;
	export type Transition<ST> = (state: ST) => ST;
	export type Effect<ST> = (state: ST, args: any) => ST | Function;
	export type Rule<ST> = (state: Readonly<ST>, args?: any) => boolean;
	export type Listener<ST> = (state: ST, transition: ST) => void;

	const setState = <ST>(context: Guard<ST>, transition: Transition<ST>) => {
		context.currentState = transition(context.currentState);
	}
	const nextEffect = <ST>(context: Guard<ST>, arr: any[]) => {
		function recur(st?: ST) {
			if (st !== undefined) {
				context.currentState = st;
			}
			if (!arr.length) {
				return;
			}
			let x = arr.pop()(context.currentState);
			if (typeof x !== "function") {
				return recur(st);
			} else {
				return x(recur);
			}
		}
		recur();
	}
	type Metadata<ST> = {
		name: string,
		result: boolean,
		state: ST,
		args: any,
	}
	class Guard<ST> {
		initialState: () => ST;
		currentState: ST;
		registry: Map<string, Rule<ST>>
		effects: Effect<ST>[];
		observe: (meta: Metadata<ST>) => void;
		constructor(initialState: () => ST, observe?: (meta: Metadata<ST>) => void) {
			this.initialState = initialState;
			this.currentState = initialState();
			this.observe = observe;
			this.registry = new Map<string, Rule<ST>>();
		}
		defineRules<KS extends string, ST>(schema: Schema<KS, ST>, acc: Rule<ST>[] = []): Rule<ST>[] {
			let names = Object.keys(schema);
			if (!names.length) {
				return acc;
			}
			for (let name of names) {
				let rule = Reflect.get(schema, name);
				if (typeof rule === "object") {
					return this.defineRules(rule, acc);
				} else {
					let r = this.defineRule(name, rule)
					acc.push(rule);
				}
			}
			return acc;
		}
		defineRule(name, pred: Rule<ST>): Rule<ST> {
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
				return r
			}
		}
		effect(fn: Effect<ST>, rule?: Rule<ST>): Rule<ST> {
			return (state, args) => {
				let r = false;
				if (rule === undefined) {
					r = true;
				} else {
					let r = rule(state, args);
				}
				if (r) {
					this.effects.push((state: ST, args: any) => {
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
			}
		}
		apply(rulename: string, args?: any): Promise<ST> {
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
		select(...rules: (Rule<ST> | string)[]): Rule<ST> {
			return (state: Readonly<ST>, args) => {
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
			}
		}
		some(...rules: (Rule<ST> | string)[]): Rule<ST> {
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
			}
		}
		every(...rules: (Rule<ST> | string)[]): Rule<ST> {
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
			}

		};
		optional(rule1: (Rule<ST> | string), rule2: (Rule<ST> | string)): Rule<ST> {
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
			}
		}
		not(rule: Rule<ST>): Rule<ST> {
			return (state, args) => {
				if (typeof rule === "string") {
					let rulename = rule;
					rule = this.registry.get(rulename);
					if (!rule === undefined) {
						throw Error(`Undefined rulename: ${rulename}`);
					}

				}
				let r = !rule(state)
				if (this.observe !== undefined) {
					this.observe({
						name: "not",
						result: r,
						state: state,
						args: args,
					});
				}
				return r;
			}
		};
		always(rule?: Rule<ST>): Rule<ST> {
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
			}
		};

	}

}

