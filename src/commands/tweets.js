const { Command, flags } = require('@oclif/command');
const fs = require('fs');
const moment = require('moment');
const OAuth = require('oauth');
const inquirer = require('inquirer');
const { cli } = require('cli-ux');
const chalk = require('chalk');
const Bluebird = require('bluebird');

const config = {
  consumer_key: '',
  consumer_secret: '',
  access_token_key: '',
  access_token_secret: '',
};

const deleteTweet = (tweetId, oauth) => {
  return new Promise((resolve, reject) => {
    oauth.post(
      `https://api.twitter.com/1.1/statuses/destroy/${tweetId}.json`,
      config.access_token_key,
      config.access_token_secret,
      {},
      (e, data) => {
        if (e) {
          reject(e);
        } else {
          resolve();
        }
      }
    );
  });
};

const unretweet = (tweetId, oauth) => {
  return new Promise((resolve, reject) => {
    oauth.post(
      `https://api.twitter.com/1.1/statuses/unretweet/${tweetId}.json`,
      config.access_token_key,
      config.access_token_secret,
      {},
      (e, data) => {
        if (e) {
          reject(e);
        } else {
          resolve();
        }
      }
    );
  });
};

const inputValidator = value => {
  if (value === '') return 'Please enter a value';
  return true;
};

const dateValidator = value => {
  const validDate = moment(value, 'MM-DD-YYYY', true).isValid();
  if (validDate) return true;
  return 'Please enter a valid date (MM-DD-YYYY)';
};

class TweetCommand extends Command {
  async run() {
    let deleteCount = 0;
    let retweetCount = 0;

    let originalFile = fs.readFileSync('tweets.js', 'utf8');
    originalFile = originalFile.replace('window.YTD.tweets.part0 = ', '');
    const tweets = JSON.parse(originalFile);

    let prompts = [
      {
        type: 'input',
        name: 'inputDate',
        message: chalk.blue('Delete tweets starting from what date?'),
        default: moment().format('MM-DD-YYYY'),
        validate: dateValidator,
      },
    ];

    if (!!process.env.API_KEY) {
      config.consumer_key = process.env.API_KEY;
    } else {
      prompts.push({
        type: 'input',
        name: 'consumerKey',
        message: chalk.magenta('Enter your "API Key" value:'),
        validate: inputValidator,
      });
    }

    if (!!process.env.API_KEY_SECRET) {
      config.consumer_secret = process.env.API_KEY_SECRET;
    } else {
      prompts.push({
        type: 'input',
        name: 'consumerSecret',
        message: chalk.blue('Enter your "API Secret Key" value:'),
        validate: inputValidator,
      });
    }

    if (!!process.env.ACCESS_TOKEN) {
      config.access_token_key = process.env.ACCESS_TOKEN;
    } else {
      prompts.push({
        type: 'input',
        name: 'accessTokenKey',
        message: chalk.magenta('Enter your "Access Token" value:'),
        validate: inputValidator,
      });
    }

    if (!!process.env.ACCESS_TOKEN_SECRET) {
      config.access_token_secret = process.env.ACCESS_TOKEN_SECRET;
    } else {
      prompts.push({
        type: 'input',
        name: 'accessTokenSecret',
        message: chalk.blue('Enter your "Access Token Secret" value:'),
        validate: inputValidator,
      });
    }

    try {
      // Provide user with a set of prompts.
      const responses = await inquirer.prompt(prompts);

      // Set config properties.
      if (!config.consumer_key) {
        config.consumer_key = responses.consumerKey;
      }
      if (!config.consumer_secret) {
        config.consumer_secret = responses.consumerSecret;
      }
      if (!config.access_token_key) {
        config.access_token_key = responses.accessTokenKey;
      }
      if (!config.access_token_secret) {
        config.access_token_secret = responses.accessTokenSecret;
      }

      // Authenticate.
      const oauth = new OAuth.OAuth(
        'https://api.twitter.com/oauth/request_token',
        'https://api.twitter.com/oauth/access_token',
        config.consumer_key,
        config.consumer_secret,
        '1.0A',
        null,
        'HMAC-SHA1'
      );

      const inputDate = new Date(responses.inputDate);

      cli.action.start(chalk.green('💥 Deleting tweets'));

      await Bluebird.each(tweets, async ({ tweet }) => {
        const tweetDate = new Date(tweet.created_at);
        if (moment(tweetDate).isAfter(moment(inputDate))) return;

        if (tweet.full_text.startsWith('RT') || tweet.retweet_status) {
          return unretweet(tweet.id, oauth)
            .then(() => {
              this.log(`${chalk.green('success')} ${chalk.gray(`Successfully unretweeted tweet ${tweet.id}`)}`);
              retweetCount += 1;
            })
            .catch((e1) =>
              this.log(
                `${chalk.red('error')} ${chalk.gray(`There was an issue trying to unretweet tweet ${tweet.id}, ${JSON.stringify(e1)}`)}`
              )
            );
        }

        return deleteTweet(tweet.id, oauth)
          .then(() => {
            this.log(`${chalk.green('success')} ${chalk.gray(`Successfully deleted tweet ${tweet.id}`)}`);
            deleteCount += 1;
          })
          .catch((e2) =>
            this.log(`${chalk.red('error')} ${chalk.gray(`There was an issue trying to delete tweet ${tweet.id}, ${JSON.stringify(e2)}`)}`)
          );
      });

      cli.action.stop(chalk.green('done 💥'));
    } catch (e) {
      this.error(
        `It is possible Twitter has updated the JSON structure of tweet.js. Please create an issue at ${chalk.underline.bold(
          'https://github.com/colbymillerdev/tweet-delete/issues'
        )} so tweet-delete can be updated 🙂 ${e}`
      );
    }

    this.log(chalk.white(`${deleteCount} tweet(s) successfully deleted.`));
    this.log(chalk.white(`${retweetCount} tweet(s) successfully unretweeted.`));
  }
}

TweetCommand.description = `Keep your Twitter feed clean by removing all tweets before a specified date!
...
Specify a date and tweet-delete will remove all tweets you've ever sent before that date.
`;

TweetCommand.flags = {
  // add --version flag to show CLI version
  version: flags.version({ char: 'v' }),
  // add --help flag to show CLI version
  help: flags.help({ char: 'h' }),
};

module.exports = TweetCommand;
