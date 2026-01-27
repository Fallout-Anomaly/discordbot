const { success } = require("../../utils/Console");
const Event = require("../../structure/Event");

module.exports = new Event({
    event: 'clientReady',
    once: true,
    run: (client) => {
        const loginDuration = ((Date.now() - client.login_timestamp) / 1000).toFixed(2);
        success(`Logged in as ${client.user.tag}, took ${loginDuration}s.`);
        success(`Active in ${client.guilds.cache.size} guild(s).`);
    }
}).toJSON();