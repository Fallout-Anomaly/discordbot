const db = require('../../utils/EconomyDB');
const { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const ApplicationCommand = require("../../structure/ApplicationCommand");

module.exports = new ApplicationCommand({
    command: {
        name: 'stats',
        description: 'View or upgrade your S.P.E.C.I.A.L. stats.',
        options: [
            {
                name: 'user',
                description: 'User to view',
                type: ApplicationCommandOptionType.User,
                required: false
            }
        ]
    },
    run: async (client, interaction) => {
        const target = interaction.options.getUser('user') || interaction.user;
        const isSelf = target.id === interaction.user.id;

        db.get(`SELECT * FROM users WHERE id = ?`, [target.id], async (err, row) => {
            if (err) return interaction.reply({ content: '❌ Database error.', ephemeral: true });

            if (!row) {
                // Initialize if not exists
                db.run('INSERT OR IGNORE INTO users (id) VALUES (?)', [target.id]);
                // Set defaults manually in object for display since DB insert is async
                row = {
                    id: target.id,
                    stat_strength: 1, stat_perception: 1, stat_endurance: 1,
                    stat_charisma: 1, stat_intelligence: 1, stat_agility: 1, stat_luck: 1,
                    stat_points: 5, health: 100, max_health: 100, radiation: 0, xp: 0, power_armor: null
                };
            }

            // Ensure defaults if null (for old users)
            const stats = {
                strength: row.stat_strength || 1,
                perception: row.stat_perception || 1,
                endurance: row.stat_endurance || 1,
                charisma: row.stat_charisma || 1,
                intelligence: row.stat_intelligence || 1,
                agility: row.stat_agility || 1,
                luck: row.stat_luck || 1,
                points: row.stat_points !== undefined ? row.stat_points : 5,
                health: row.health || 100,
                max_health: row.max_health || 100,
                radiation: row.radiation || 0,
                xp: row.xp || 0,
                power_armor: row.power_armor || null
            };

            const embed = new EmbedBuilder()
                .setTitle(`📝 S.P.E.C.I.A.L. - ${target.username}`)
                .setColor('#2ecc71')
                .setDescription(isSelf && stats.points > 0 ? `You have **${stats.points}** points available to spend!` : 'Status Overview')
                .addFields(
                    { name: '💪 Strength', value: `${stats.strength}`, inline: true },
                    { name: '👀 Perception', value: `${stats.perception}`, inline: true },
                    { name: '🛡️ Endurance', value: `${stats.endurance}`, inline: true },
                    { name: '🗣️ Charisma', value: `${stats.charisma}`, inline: true },
                    { name: '🧠 Intelligence', value: `${stats.intelligence}`, inline: true },
                    { name: '🏃 Agility', value: `${stats.agility}`, inline: true },
                    { name: '🍀 Luck', value: `${stats.luck}`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: true }, // Spacer
                    { name: '❤️ Health', value: `${stats.health}/${stats.max_health}`, inline: true },
                    { name: '☢️ Radiation', value: `${stats.radiation}%`, inline: true },
                    { name: '✨ XP', value: `${stats.xp}`, inline: true },
                    { name: '🤖 Power Armor', value: stats.power_armor ? `**Equipped**` : '❌ None', inline: true }
                );

            if (isSelf && stats.points > 0) {
                // Add dropdown to allocate points
                const select = new StringSelectMenuBuilder()
                    .setCustomId(`stats_upgrade_${target.id}`)
                    .setPlaceholder('Select a stat to upgrade (+1)')
                    .addOptions(
                        { label: 'Strength', value: 'stat_strength', description: 'Increases carry weight & melee dmg' },
                        { label: 'Perception', value: 'stat_perception', description: 'Increases scavenge loot chance' },
                        { label: 'Endurance', value: 'stat_endurance', description: 'Increases max health' },
                        { label: 'Charisma', value: 'stat_charisma', description: 'Better shop prices & XP gain' },
                        { label: 'Intelligence', value: 'stat_intelligence', description: 'More XP from actions' },
                        { label: 'Agility', value: 'stat_agility', description: 'Dodge attacks & steal chance' },
                        { label: 'Luck', value: 'stat_luck', description: 'Better gambling odds' }
                    );

                const rowComponent = new ActionRowBuilder().addComponents(select);

                const { message } = await interaction.reply({ 
                    embeds: [embed], 
                    components: [rowComponent], 
                    withResponse: true 
                });

                // Create collector
                const collector = message.createMessageComponentCollector({ 
                    componentType: ComponentType.StringSelect, 
                    time: 60000 
                });

                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) return i.reply({ content: 'Not your menu.', ephemeral: true });

                    const statColumn = i.values[0];
                    const statName = i.values[0].replace('stat_', '');

                    // Atomic upgrade: only deduct if points > 0
                    db.run(
                        `UPDATE users 
                         SET ${statColumn} = ${statColumn} + 1, 
                             stat_points = stat_points - 1 
                         WHERE id = ? AND stat_points > 0`,
                        [i.user.id],
                        function (err) {
                            if (err) {
                                return i.update({ content: '❌ Database error.', components: [] });
                            }
                            if (this.changes === 0) {
                                return i.update({ content: '❌ Not enough points!', components: [] });
                            }
                            i.reply({ content: `✅ Upgraded **${statName}**! Run /stats again to see changes.`, ephemeral: true });
                        }
                    );
                });

            } else {
                interaction.reply({ embeds: [embed] });
            }
        });
    }
}).toJSON();
