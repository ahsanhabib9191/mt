
module.exports = {
    apps: [
        {
            name: "API_SERVER",
            script: "./server/index.ts", // Or wherever your entry is, likely server/index.ts
            interpreter: "node",
            interpreter_args: "-r ts-node/register",
            env: {
                NODE_ENV: "development",
                PORT: 3000
            },
            watch: ["server"], // Restart API on code change
            ignore_watch: ["node_modules", "logs", "scripts"],
        },
        {
            name: "LAUNCH_WORKER",
            script: "./scripts/launch-worker-process.ts",
            interpreter: "node",
            interpreter_args: "-r ts-node/register",
            env: {
                NODE_ENV: "development"
            },
            // Workers should NOT auto-restart on code change mid-job in prod, 
            // but in dev it's fine. 
            watch: ["lib/services/workers", "lib/services/queue"],
        },
        {
            name: "OPTIMIZATION_BRAIN",
            script: "./scripts/run-optimization.ts",
            interpreter: "node",
            interpreter_args: "-r ts-node/register",
            env: {
                NODE_ENV: "development"
            },
            watch: ["lib/services/optimization"],
        }
    ]
};
