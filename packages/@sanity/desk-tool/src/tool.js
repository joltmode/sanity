import React, {useEffect} from 'react'
import UUID from '@sanity/uuid'
import Icon from 'part:@sanity/base/view-column-icon'
import {route, useRouterState} from 'part:@sanity/base/router'
import {parsePanesSegment, encodePanesSegment} from './utils/parsePanesSegment'
import IntentResolver from './components/IntentResolver'
import DeskTool from './DeskTool'
import {EMPTY_PARAMS} from './'

function toState(pathSegment) {
  return parsePanesSegment(decodeURIComponent(pathSegment))
}

function toPath(panes) {
  return encodePanesSegment(panes)
}

function legacyEditParamsToState(params) {
  try {
    return JSON.parse(decodeURIComponent(params))
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to parse JSON parameters')
    return {}
  }
}

function legacyEditParamsToPath(params) {
  return JSON.stringify(params)
}

const state = {activePanes: []}

function setActivePanes(panes) {
  state.activePanes = panes
}

function DeskToolPaneStateSyncer(props) {
  const {intent, params, payload} = useRouterState()
  useEffect(() => {
    // Set active panes to blank on mount and unmount
    setActivePanes([])
    return () => setActivePanes([])
  }, [])

  return intent ? (
    <IntentResolver intent={intent} params={params} payload={payload} />
  ) : (
    <DeskTool {...props} onPaneChange={setActivePanes} />
  )
}

// eslint-disable-next-line complexity
function getIntentState(intentName, params, currentState, payload) {
  const paneSegments = (currentState && currentState.panes) || []
  const activePanes = state.activePanes || []
  const editDocumentId = params.id || UUID()
  const isTemplate = intentName === 'create' && params.template

  // Loop through open panes and see if any of them can handle the intent
  for (let i = activePanes.length - 1; i >= 0; i--) {
    const pane = activePanes[i]
    if (pane.canHandleIntent && pane.canHandleIntent(intentName, params, {pane, index: i})) {
      const paneParams = isTemplate ? {template: params.template} : EMPTY_PARAMS
      return {
        panes: paneSegments
          .slice(0, i)
          .concat([[{id: editDocumentId, params: paneParams, payload}]])
      }
    }
  }

  return {intent: intentName, params, payload}
}

export default {
  router: route('/', [
    // "Asynchronous intent resolving" route
    route.intents('/intent'),

    // Legacy fallback route, will be redirected to new format
    route('/edit/:type/:editDocumentId', [
      route({
        path: '/:params',
        transform: {params: {toState: legacyEditParamsToState, toPath: legacyEditParamsToPath}}
      })
    ]),

    // The regular path - when the intent can be resolved to a specific pane
    route({
      path: '/:panes',
      // Legacy URLs, used to handle redirects
      children: [route('/:action', route('/:legacyEditDocumentId'))],
      transform: {
        panes: {toState, toPath}
      }
    })
  ]),
  canHandleIntent(intentName, params) {
    return Boolean(
      (intentName === 'edit' && params.id) ||
        (intentName === 'create' && params.type) ||
        (intentName === 'create' && params.template)
    )
  },
  getIntentState,
  title: 'Desk',
  name: 'desk',
  icon: Icon,
  component: DeskToolPaneStateSyncer
}
