﻿var React = require('react');
var ReactDOM = require('react-dom');
var Router = require('react-router').Router;
var Route = require('react-router').Route;
var browserHistory = require('react-router').browserHistory;
var PubSub = require('pubsub-js');


require('bootstrap/dist/css/bootstrap.css');
require('./assets/font-awesome-4.6.3/css/font-awesome.css');
require('./assets/customPositions.css');
require('./assets/customColors.css');

var EditCommunity = require('./components/editCommunity');
var ChooseCommunity = require('./components/chooseCommunity');

var MyBody = require('./body');


var MainLayout = require('./layouts/main');

var IssueHours = require('./components/issueHours/issueHours');
var CommunityIssue = React.createClass({
    render: function () {
        return (
            <CommunityIssue useTreasury="true" />
        );
    }
});


var ShowTransaction = require('./components/issueHours/showTransaction');
var Landing = require('./landing');
var TxHistory = require('./components/balance/history');


//var testComp = require('./components/recentIssues');

var Wrapper = React.createClass({
    getInitialState() {
        return {};
    },

    onCommunitySelected(e) {
        this.setState({ communityHandle: e });
    },

    componentWillMount() {
        var me = this;
        this.pubSub_token = PubSub.subscribe('SIGNEDOUT', function (msg, data) {
            me.setState({ communityHandle: null });
        });
    },
    componentWillUnmount() {
        PubSub.unsubscribe(this.pubSub_token);
    },

    render: function() {
        return (
    <div>
        
        {
            this.state.communityHandle?
            <Router history={browserHistory} >
                <Route component={MainLayout}>
                    <Route path="/" component={Landing}/>
                    <Route path="spend" component={IssueHours}/>
                    <Route path="issue" component={CommunityIssue}/>
                    <Route path="transaction/:mutationHash" component={ShowTransaction}/>
                    <Route path="txhistory/:handle" component={TxHistory}/>
                    <Route path="txhistory" component={TxHistory}/>
                    <Route path="editcommunity/:handle" component={EditCommunity}/>
                </Route>
            </Router>
            :
            <ChooseCommunity onSelected={this.onCommunitySelected}/>
        }
    </div>
        );
}
});

ReactDOM.render(<Wrapper/>,
    document.getElementById('theApp')
);