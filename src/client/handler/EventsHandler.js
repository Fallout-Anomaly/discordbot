const { info, error, success } = require('../../utils/Console');
const { readdirSync } = require('fs');

class EventsHandler {
    client;
    loadedEvents = new Map(); // Track which events have been loaded and their handlers

    /**
     *
     * @param {DiscordBot} client 
     */
    constructor(client) {
        this.client = client;
    }

    load = () => {
        let total = 0;

        // Clear only the listeners we previously registered, not all listeners globally
        // This prevents removing listeners added manually in index.js or DiscordBot.js
        for (const [eventName, handlers] of this.loadedEvents.entries()) {
            handlers.forEach(handler => {
                this.client.removeListener(eventName, handler);
            });
        }
        this.loadedEvents.clear();

        for (const directory of readdirSync('./src/events/')) {
            for (const file of readdirSync('./src/events/' + directory).filter((f) => f.endsWith('.js'))) {
                try {
                    /**
                     * @type {Event['data']}
                     */
                    const module = require('../../events/' + directory + '/' + file);

                    if (!module) continue;

                    if (module.__type__ === 5) {
                        if (!module.event || !module.run) {
                            error('Unable to load the event ' + file);
                            continue;
                        }

                        // Create a wrapped handler for tracking
                        const handler = (...args) => module.run(this.client, ...args);

                        if (module.once) {
                            this.client.once(module.event, handler);
                        } else {
                            this.client.on(module.event, handler);
                        }

                        // Track this handler so we can remove it later
                        if (!this.loadedEvents.has(module.event)) {
                            this.loadedEvents.set(module.event, []);
                        }
                        this.loadedEvents.get(module.event).push(handler);

                        info(`Loaded new event: ` + file);

                        total++;
                    } else {
                        error('Invalid event type ' + module.__type__ + ' from event file ' + file);
                    }
                } catch (err) {
                    error('Unable to load an event from the path: ' + 'src/events/' + directory + '/' + file);
                    console.error(err);
                }
            }
        }

        success(`Successfully loaded ${total} events.`);
    }
}

module.exports = EventsHandler;