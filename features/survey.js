// Threaded conversation illustrating a survey.
// Responses are posted into the Webex Teams Space
// configured via SURVEY_SPACE (the bot must be a member)
// or simply back into the Space the survey was submitted from
// if SURVEY_RESULTS_SPACE is empty

const { BotkitConversation } = require( 'botkit' );

module.exports = function ( controller ) {

    const convo = new BotkitConversation( 'survey_chat', controller );

    convo.before( 'default', async ( convo, bot ) => {

        if ( !convo.vars.survey_space ) {

            convo.setVar( 'survey_space', 
                process.env.SURVEY_RESULTS_SPACE ? process.env.SURVEY_RESULTS_SPACE : convo.vars.channel );
            
            if ( !process.env.SURVEY_RESULTS_SPACE ) {
                await convo.gotoThread( 'survey_warn_space' );
            }
        }
    } );

    let question = 'Which statement is false? Please respond with `1`, `2` or `3`.\n';
    question += '1. I can speak 8 different languages/dialects. \n';
    question += '2. In 2008, I had an accident and now have a prosthetic left leg. \n';
    question += '3. At the age of 14, I got bored after school hours so I worked in a construction site and got paid $4 for 4 hours work. \n';
        
    convo.ask( { channelData: { markdown: question } }, [
        {
            pattern: '1|2|3',
            handler: async ( response, convo ) => {
                await convo.gotoThread( 'survey_submit' );
            }
        },
        {
            default: true,
            handler: ( async ( response, convo ) => {
                await convo.gotoThread( 'survey_cancel' );
            })
        }
    ], 'survey_session_id' );

    convo.addMessage( {
        text: 'No survey results Space configured; using current Space',
        action: 'default'
    }, 'survey_warn_space');

    convo.addMessage( {
        text: 'Unrecognized session Id...',
        action: 'default'
    }, 'survey_cancel' );

    let rate = `How would you rate this session?  \n`;
    rate += '_Options: 1|poor, 2|weak, 3|adequate, 4|good, 5|great_  \n';
    rate += '_(or provide your own free-form response!)_';

    convo.addQuestion( 
        { channelData: { markdown: rate } }, 
        async ( response, convo ) => {

            await convo.gotoThread( 'survey_submit' );
        },
        'survey_rating',
        'survey_confirm' );

    convo.before( 'survey_submit', async ( convo, bot) => {

        let result = '';

        await bot.api.messages.create( {
            roomId: convo.vars.survey_space,
            text: `${ controller.api.people.get } said that item ${ convo.vars.survey_session_id } is false`
        } )
        .then( async () => {
            convo.setVar('survey_result', 'Thanks for participating!')
        } )
        .catch( async ( err ) => {
            convo.setVar('survey_result', `Error submitting results: ${err.body.message}`)
        } )
    } );

    convo.addMessage( {
        text: '{{vars.survey_result}}',
        action: 'complete'
    }, 'survey_submit' )

    controller.addDialog( convo );

    controller.hears( 'survey', 'message,direct_message', async ( bot, message ) => {

        await bot.beginDialog( 'survey_chat' );
    });

    controller.commandHelp.push( { command: 'survey', text: 'Ask a survey question, post results to a Webex Teams Space' } );

}
