﻿'use strict';
var React = require('react');


var FormGroup = require('react-bootstrap').FormGroup;
var FormControl = require('react-bootstrap').FormControl;
var HelpBlock = require('react-bootstrap').HelpBlock;
var Button = require('react-bootstrap').Button;
var InputGroup = require('react-bootstrap').InputGroup;
var Tooltip = require('react-bootstrap').Tooltip;
var OverlayTrigger = require('react-bootstrap').OverlayTrigger;
var Form = require('react-bootstrap').Form;

var DropdownInput = require('../inputDropDown');
var request = require('superagent');
var withsupererror = require('../../js/withsupererror');

var apiService = require('../../js/apiService');

var EditUser = require('../editUser/editUser');

var bizValidator = require('../../js/bizValidator');

var UserCompactTemplate = require('../compactUser');

module.exports = React.createClass({
    processProperties(receipent) {
        receipent.isUpdating = receipent.user && true;
        receipent.Errors = {};
        return receipent;
    },
    getInitialState() {
        return this.processProperties(this.props.recepient);
    },
    componentWillReceiveProps: function (nextProps) {
        this.setState(this.processProperties(nextProps.recepient));
    },

    componentWillMount() {
        this.validator = new bizValidator(this, {
            hours: { required: true, max_value: 10 }
        });
    },

    OnhoursChange(e) {
        this.setState({ hours: e.target.value });
    },

    onAddUser(e) {
        e.preventDefault();

        if (!this.validator.isValid())
            return;


        if (this.props.addNewRecepient)
            this.props.addNewRecepient(this.state);
        
        
    },

    fetchUsers(pattern) {

        return apiService.getcredsAync()
        .then(function(creds){
            return request
            .get('/api/User/' + pattern)
            .set('Accept', 'application/json')
            .authBearer(creds.token)
            .use(withsupererror).end();
        })
        .then(function(results){
            return results.body;
        });
    },

    onUserSelected(e) {
        this.setState({ user: e });
    },

    onChangeUser() {
        this.setState({ user: null });
    },

    showUserDlg() { this.setState({ NewUser: {} }) },
    onUserEditCompleted(user) {
        this.setState({ NewUser: null });
        this.setState({ user: user });
    },

    render: function () {
        const receiverTooltip = (
            <Tooltip id="receiverTooltip">Please enter receiver's handle</Tooltip>
        );
        const useraddTooltip = (
            <Tooltip id="useraddTooltip">Add new user</Tooltip>
        );

        const changeUserTooltip = (
            <Tooltip id="editTooltip">Change receiveing user</Tooltip>
        );


        return (

            <Form inline onSubmit={this.onAddUser} 
                  className="forminLinewithHelpBlock text-center">
                
                <EditUser user={this.state.NewUser} onCompleted={this.onUserEditCompleted}/>
                
                <FormGroup>
                    {this.state.user?
                    <div style={{position:'relative'}}>
                        
                        <UserCompactTemplate data={this.state.user}/>

                        <OverlayTrigger placement="bottom" overlay={changeUserTooltip}>
                            <Button onClick={this.onChangeUser}
                                    bsStyle="link" 
                                    style={{ padding: '0px' ,position: 'absolute',
                                                        right: '0px', top: '0px'} }>
                                <i className="fa fa-edit"></i>
                            </Button>
                        </OverlayTrigger>

                    </div>
                    :
                    <InputGroup>
                        
                        <InputGroup.Addon>
                            <OverlayTrigger placement="right" 
                                                          overlay={receiverTooltip}>
                                <i className="fa fa-user"></i>
                            </OverlayTrigger>
                        </InputGroup.Addon>
                        
                        <DropdownInput placeholder="Search for user"
                                       onSelected={this.onUserSelected}
                                       SearchQuery={this.fetchUsers}>
                            <UserCompactTemplate imgStyle={{width:'50px'}} bsStyle={{width:'350px'}}/>
                            
                        </DropdownInput>
                        
                        <InputGroup.Button>
                            <Button onClick={this.showUserDlg}
                                    ><OverlayTrigger placement="left" 
                                                      overlay={useraddTooltip}>
                                        <i className="fa fa-user-plus text-warning"></i>
                            </OverlayTrigger></Button>
                        </InputGroup.Button>
                        
                    </InputGroup>
                    
                    
                    }
                    
                </FormGroup>

                <FormGroup  validationState={this.validator.validate('hours')}>
                    <InputGroup style={{ maxWidth: '190px' } }>
                        <InputGroup.Addon><i className="fa fa-clock-o"></i></InputGroup.Addon>
                        <FormControl type="number" 
                                value={this.state.hours} onChange={this.OnhoursChange}         
                                placeholder="hours" />
                        <InputGroup.Addon>hours</InputGroup.Addon>
                    </InputGroup>
                    <HelpBlock>{this.state.Errors.hours}</HelpBlock>
                </FormGroup>

                <FormGroup>
                    <Button type="submit" bsStyle="info" disabled={!this.state.user}>
                        Add receiver
                    </Button>
                </FormGroup>
            </Form>

            );
    }
});
