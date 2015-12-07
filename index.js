'use strict'
const _ = require('lodash')
const EventEmitter = require('events').EventEmitter
const https = require('https')
const querystring = require('querystring')
const WebSocket = require('ws')

const slackToken = process.env.TOKEN // Add a bot at https://my.slack.com/services/new/bot and copy the token here
const slackHost = process.env.HOST
const botName = process.env.BOTNAME

const slack = login()

const commands = {
  'add task ': 'add',
  'new task ': 'add',
  'complete task ': 'complete',
  'check task ': 'complete',
  'check off task ': 'complete',
  'checkoff task ': 'complete',
  'uncomplete task ': 'uncomplete',
  'uncheck task ': 'uncomplete',
  'delete task ': 'delete',
  'remove task ': 'delete'
}

slack.socket.on('message', (data) => {
  if (data.type !== 'message') return
  if (data.user === slack.userId) return

  const task = getTask(data.text)
  if (!task) return

  const channelId = data.channel
  fetchFirstPost(channelId, slack.userId, 0, (err, message) => {
    if (err) return

    if (task.command === 'add') {
      if (message == null) {
        postNewList(channelId, task.argument, () => {})
      } else {
        const newText = addToList(message.text, task.argument)
        updateMessage(message, channelId, newText, (err, data) => {console.log(err, data)})
      }
    }
  })
})

function addToList (listText, text) {
  const listLines = listText.split('\n')
  const endIndex = _.findIndex(listLines, line => line === '*Completed Tasks:*') - 1
  const lastNumber = listLines[endIndex - 1].split(')')[0].trim()
  const thisNumber = `${(parseInt(lastNumber, 10) || 0) + 1}`
  listLines.splice(endIndex, 0, `  ${thisNumber}) ${text}`)
  return listLines.join('\n')
}

function completeEntry (listText, index) {
  const listLines = listText.split('\n')
  const thisIndex = parseInt(index)
  const thisNumber = listLines[thisNumber].split(')')[0].trim()
  if (thisNumber === `${thisIndex}

}

function getTask (text) {
  for (let command in commands) {
    if (_.startsWith(text, command)) {
      return {argument: text.slice(command.length), command: commands[command]}
    }
  }
}

function updateMessage(message, channelId, newText, callback) {
  apiCall('chat.update', {ts: message.ts, channel: channelId, text: newText}, callback)
}

function postNewList(channelId, entry, callback) {
  apiCall('chat.postMessage', {channel: channelId, text: `*Todo List for this Channel:*\n  1) ${entry}\n\n*Completed Tasks:*\n`, as_user: true}, callback)
}

function fetchFirstPost(channelId, userId, oldest, callback) {
  const category = categoryFromChannelId(channelId)
  apiCall(`${category}.history`, {channel: channelId, oldest}, (err, result) => {
    console.log(result)
    const firstOwnMessage = _.findLast(result.messages, (message) => message.user === userId)
    if (firstOwnMessage) {
      callback(null, firstOwnMessage)
    } else {
      if (result.has_more) {
        fetchFirstPost(channelId, result.latest, callback)
      } else {
        callback()
      }
    }
  })
}

function categoryFromChannelId(channelId) {
  switch (channelId[0]) {
    case 'C': return 'channels'
    case 'D': return 'im'
    case 'G': return 'groups'
  }
}

function login () {
  const slack = {socket: new EventEmitter()}

  apiCall('rtm.start', {agent: 'node-slack'}, (err, data) => {
    slack.userId = data.self.id

    const socketUrl = data.url
    const ws = new WebSocket(socketUrl)

    ws.on('open', () => {
      //maybe pong later
    })

    ws.on('message', (jsonData, flags) => {
      const data = JSON.parse(jsonData)
      slack.socket.emit('message', data)
    })

      // @_connAttempts = 0
      // @_lastPong = Date.now()
      //
      // # start pings
      // @_pongTimeout = setInterval =>
      //   if not @connected then return
      //
      //   @logger.debug 'ping'
      //   @_send {"type": "ping"}
      //   if @_lastPong? and Date.now() - @_lastPong > 10000
      //     @logger.error "Last pong is too old: %d", (Date.now() - @_lastPong) / 1000
      //     @authenticated = false
      //     @connected = false
      //     @reconnect()
      // , 5000

  //   @ws.on 'message', (data, flags) =>
  //     # flags.binary will be set if a binary data is received
  //     # flags.masked will be set if the data was masked
  //     @onMessage JSON.parse(data)
  //
  //   @ws.on 'error', (error) =>
  //     # TODO: Reconnect?
  //     @emit 'error', error
  //
  //   @ws.on 'close', (code, message) =>
  //     @emit 'close', code, message
  //     @connected = false
  //     @socketUrl = null
  //
  //   return true
  })

  return slack
}

function apiCall (method, params, callback) {
  if (!params) params = {}

  params['token'] = slackToken

  const post_data = querystring.stringify(params)

  const options = {
    hostname: slackHost,
    method: 'POST',
    path: `/api/${method}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': post_data.length
    }
  }

  const req = https.request(options)

  req.on('response', (res) => {
    let buffer = ''
    res.on('data', (chunk) => {
      buffer += chunk
      res.on('end', () => {
        if (res.statusCode === 200) {
          const value = JSON.parse(buffer)
          callback(null, value)
        } else {
          callback(new Error(`API response: ${res.statusCode}`))
        }
      })
    })
  })

  req.on('error', (error) => {
    callback(new Error(`API response: ${error.errno}`))
  })

  req.write(post_data)
  req.end()
}


// function getFirstMessage(channel, user, oldest) {
//   const history = channel.fetchHistory(undefined, oldest)
//   const latest = history.latest
//   console.log(history)
//   console.log(channel.getHistory())
//   _.find(history.messages, message => message.user === user.id)
// }
//
// slack.on('open', () => {
//   console.log(`Connected to ${slack.team.name} as @${slack.self.name}`)
// })
//
// slack.on('message', message => {
//   const channelId = message.channel
//   const channel = slack.getChannelGroupOrDMByID(channelId)
//   getFirstMessage(channel, slack.self)
// })
//
// slack.on('error', err => {
//   console.error('Error', err)
// })
//
// slack.login()
