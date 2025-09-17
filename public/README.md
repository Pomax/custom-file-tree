# Websocket demo

The websocket demo cannot be run on Github, unfortunately, as websockets require a persistent server process. However, if you run the code locally, you can run the websocket demo to see everything working together, as long as you have `caddy` installed, which is necessary to ensure that your `localhost` domain works over https (without setting up any TLS certificates yourself, not even through letsencrypt. Caddy just automatically makes sure https works, no questions asked).

## Server-side

The server side code can be found in [server-side-websockets.js](../server-side-websockets.js) and is tied to a "content directory" that houses all websocket-servable file system data, with each client needing to say which directory in that content dir they want to be working with. Because you don't necessarily want every websocket connection to work on the same full file tree. For example: if your content dir houses a bunch of different project, you may want websocket connections to be for specific projects, not "all projects available to the system".

The server code tracks which connections are for which dirs, and ensures that all transformations (i.e. operations that modify the filesystem) are tracked as a sequence. Clients get notified of changes, with each changed tagged with its sequence number so that clients can tell whether or not they're still in sync with the server, and if they're not, they can request to be "caught up".

File _content_ changes are not technically handled by the server code, instead relying on you to provide an update handling function that knows how to deal with the type of updating you've decided to use for your system, as there are far too many ways to communicate content changes.

For the demo, content changes use `jsdiff`, which assumes your content is plain text, and produces text diffs in the standard form so that small changes to huge documents don't require sending the entire document over, but only a few lines.

## Client-side

On the client side, the websocket code can be found in the [websocket-interface.js](../src/classes/websocket-interface.js) class, which sits between the `<file-tree>` element and the remote filesystem and acts as mediator: any changes made in the file tree trigger the equivalent action in the websocket interface, which packs up the action and sends it off to the server for processing and then broadcasting (because even if you perform an action in your browser, that action may not be allowd on the server, and so may need to be rolled back!).

## Operational flow

1. The file tree connects to a secure websocket server.
1. The file tree sends a message indicating which directory they want to "watch".
1. The server sends the dir tree over.
1. A user makes a change in the file tree.
1. The file tree sends that change to the websocket interface.
1. The interface sends the change to the server.
1. The server processes the change and broadcasts the change to everyone.
1. The interface receives the change and checks who it's from
   1. if we're waiting to have changes acknowledged:
      1. if this is the change we expected, do nothing
      1. if it's not, roll back any changes we made so that we're in the correct state and apply this new change instead
   1. if we don't have pending changes
      1. if the sequence number is "the next action":
         1. if it's "from us", and the change matches what we we do nothing
         1. if it's from "someone else", it calls the appropriate file tree function.
      1. if it's not, we missed a bunch of messages: request a "replay" of all messages we missed, to catch us up.
