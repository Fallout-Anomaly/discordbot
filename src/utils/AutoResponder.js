const triggers = require('../data/autoTriggers.json');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    /**
     * Checks a message for auto-response triggers.
     * @param {Message} message - The Discord message object
     * @returns {Promise<boolean>} - True if a response was sent, False otherwise.
     */
    async checkAndRespond(message) {
        if (!message.content) return false;
        
        const content = message.content.toLowerCase();
        let triggeredResponse = null;

        for (const trigger of triggers) {
            const matches = trigger.keywords.filter(kw => content.includes(kw.toLowerCase())).length;
            if (matches >= 2 || (trigger.keywords.length === 1 && matches === 1)) {
                triggeredResponse = trigger.response;
                break;
            }
        }

        if (triggeredResponse) {
             const embed = new EmbedBuilder()
                .setTitle('⚡ Anomaly Auto-Support')
                .setDescription(triggeredResponse)
                .setColor('#e74c3c')
                .setFooter({ text: 'This represents a known common issue. If this doesn\'t help, ask a staff member.' })
                .setTimestamp();
            
             await message.reply({ embeds: [embed] });
             // Attempt to react, catch error if permission missing
             await message.react('⚡').catch(() => {}); 
             return true;
        }
        return false;
    }
};
