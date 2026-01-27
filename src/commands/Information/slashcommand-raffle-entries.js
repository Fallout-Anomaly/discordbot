const { ApplicationCommandOptionType } = require('discord.js');
const ApplicationCommand = require('../../structure/ApplicationCommand');
const DonorSystem = require('../../utils/DonorSystem');
const config = require('../../config');
const db = require('../../utils/EconomyDB');

module.exports = new ApplicationCommand({
    command: {
        name: 'raffle-entries',
        description: 'Check your raffle entries for this month',
        options: [{
            name: 'user',
            description: 'Check a specific user (staff only)',
            type: ApplicationCommandOptionType.User
        }]
    },
    run: async (client, interaction) => {
        const staffRoleId = config.roles?.staff_role || process.env.STAFF_ROLE_ID;
        const isStaff = interaction.member.roles.cache.has(staffRoleId);
        const targetUser = interaction.options.getUser('user');
        
        if (targetUser && !isStaff) {
            return interaction.reply({ content: '❌ Only staff can check other users\' raffle entries.', flags: 64 });
        }

        const userId = targetUser ? targetUser.id : interaction.user.id;
        const donor = await DonorSystem.getDonor(userId);

        if (!donor) {
            return interaction.reply({
                content: `${targetUser ? targetUser.username : 'You'} ${targetUser ? 'is' : 'are'} not a supporter. Become one to enter the raffle!`,
                flags: 64
            });
        }

        const entries = await DonorSystem.getRaffleEntries(userId);
        const tierInfo = DonorSystem.TIERS[donor.tier];
        const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        // Fetch entries for active custom raffles
        const customEntries = await new Promise((resolve) => {
            db.all(
                `SELECT r.title, COUNT(re.user_id) as count 
                 FROM raffle_entries re 
                 JOIN custom_raffles r ON re.raffle_id = r.id 
                 WHERE re.user_id = ? AND r.status = 'open' 
                 GROUP BY r.id`,
                [userId],
                (err, rows) => resolve(rows || [])
            );
        });

        const embed = new EmbedBuilder()
            .setTitle('🎰 Raffle Dashboard')
            .setDescription(`**${tierInfo.name}** Status`)
            .addFields(
                { 
                    name: '📅 Monthly Supporter Pool', 
                    value: `**${entries}** entries for ${currentMonth}\n(Limit: ${tierInfo.raffle_entries_per_month}/mo)`, 
                    inline: false 
                }
            );

        if (customEntries.length > 0) {
            const entryList = customEntries.map(e => `• **${e.title}**: ${e.count} entries`).join('\n');
            embed.addFields({ name: '🎟️ Active Custom Raffles', value: entryList, inline: false });
        } else {
            embed.addFields({ name: '🎟️ Active Custom Raffles', value: 'No entries in active community raffles.', inline: false });
        }

        embed.setColor(tierInfo.color)
            .setFooter({ text: 'Monthly entries are automatic. Custom raffles require tickets.' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
}).toJSON();
