/**
 * Copyright (c) 2020, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { getRolesList } from "@wso2is/core/api";
import { AlertLevels, RolesInterface, TestableComponentInterface } from "@wso2is/core/models";
import { addAlert } from "@wso2is/core/store";
import { useTrigger } from "@wso2is/forms";
import { Heading, LinkButton, PrimaryButton, Steps } from "@wso2is/react-components";
import React, { FunctionComponent, ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Button, Grid, Icon, Modal } from "semantic-ui-react";
import { AddGroupUsers } from "./group-assign-users";
import { GroupBasics } from "./group-basics";
import { CreateGroupSummary } from "./group-summary";
import { AppConstants, AssignRoles, RolePermissions, history } from "../../../core";
import { updateRole } from "../../../roles/api";
import { createGroup } from "../../api";
import { GroupsWizardStepIcons } from "../../configs";
import {
    CreateGroupInterface,
    CreateGroupMemberInterface
} from "../../models";

/**
 * Interface which captures create group props.
 */
interface CreateGroupProps extends TestableComponentInterface {
    closeWizard: () => void;
    updateList: () => void;
    initStep?: number;
}

/**
 * Enum for wizard steps form types.
 * @readonly
 * @enum {string}
 */
enum WizardStepsFormTypes {
    BASIC_DETAILS = "BasicDetails",
    USER_LIST = "UserList",
    ROLE_LIST = "RoleList",
    SUMMARY = "summary"
}

/**
 * Interface to capture current wizard state
 */
interface WizardStateInterface {
    [ key: string ]: any;
}

/**
 * Component to handle addition of a new group to the system.
 *
 * @param props props related to the create group wizard
 */
export const CreateGroupWizard: FunctionComponent<CreateGroupProps> = (props: CreateGroupProps): ReactElement => {

    const {
        closeWizard,
        initStep,
        [ "data-testid" ]: testId
    } = props;

    const { t } = useTranslation();
    const dispatch = useDispatch();

    const [ currentStep, setCurrentWizardStep ] = useState<number>(initStep);
    const [ partiallyCompletedStep, setPartiallyCompletedStep ] = useState<number>(undefined);
    const [ wizardState, setWizardState ] = useState<WizardStateInterface>(undefined);
    const [ selectedUserStore, setSelectedUserStore ] = useState<string>("");

    const [ submitGeneralSettings, setSubmitGeneralSettings ] = useTrigger();
    const [ submitRoleList, setSubmitRoleList ] = useTrigger();
    const [ submitGroupUserList, setSubmitGroupUserList ] = useTrigger();
    const [ finishSubmit, setFinishSubmit ] = useTrigger();

    const [ viewRolePermissions, setViewRolePermissions ] = useState<boolean>(false);
    const [ isRoleSelected, setRoleSelection ] = useState<boolean>(false);
    const [ selectedRoleId, setSelectedRoleId ] = useState<string>();

    const [ roleList, setRoleList ] = useState<RolesInterface[]>([]);
    const [ tempRoleList, setTempRoleList ] = useState<RolesInterface[]>([]);
    const [ initialRoleList, setInitialRoleList ] = useState<RolesInterface[]>([]);
    const [ initialTempRoleList, setInitialTempRoleList ] = useState<RolesInterface[]>([]);
    const [ isEnded, setEnded ] = useState<boolean>(false);

    /**
     * Sets the current wizard step to the previous on every `partiallyCompletedStep`
     * value change , and resets the partially completed step value.
     */
    useEffect(() => {
        if (partiallyCompletedStep === undefined) {
            return;
        }

        setCurrentWizardStep(currentStep - 1);
        setPartiallyCompletedStep(undefined);
    }, [ partiallyCompletedStep ]);

    useEffect(() => {
        if (!selectedRoleId) {
            return;
        }

        if (isRoleSelected) {
            setViewRolePermissions(true);
        }
    }, [ isRoleSelected ]);

    useEffect(() => {
        if (roleList.length < 1) {
            getRolesList(null)
                .then((response) => {
                    setRoleList(response.data.Resources);
                });
        }
    }, []);

    useEffect(() => {
        if(!isEnded) {
            return;
        }

        if (wizardState && wizardState[ WizardStepsFormTypes.BASIC_DETAILS ]) {
            addGroup(wizardState[ WizardStepsFormTypes.BASIC_DETAILS ]);
        }
    }, [ wizardState && wizardState[ WizardStepsFormTypes.BASIC_DETAILS ] ]);

    const handleRoleIdSet = (roleId) => {
        setSelectedRoleId(roleId);
        setRoleSelection(true);
    };

    const handleRoleListChange = (roleList) => {
        setRoleList(roleList);
    };

    const handleInitialRoleListChange = (roleList) => {
        setInitialRoleList(roleList);
    };

    const handleAddedRoleListChange = (newRoleList) => {
        setTempRoleList(newRoleList);
    };

    const handleAddedRoleInitialListChange = (newRoleList) => {
        setInitialTempRoleList(newRoleList);
    };

    /**
     * Method to handle create group action when create group wizard finish action is triggered.
     *
     * @param groupDetails - basic data required to create group.
     */
    const addGroup = (groupDetails: any): void => {

        const members: CreateGroupMemberInterface[] = [];
        const users = groupDetails?.UserList;
        if (users?.length > 0) {
            users?.forEach(user => {
                members?.push({
                    display: user.userName,
                    value: user.id
                })
            })
        }

        const groupData: CreateGroupInterface = {
            "displayName": groupDetails?.BasicDetails ? groupDetails?.BasicDetails?.groupName : groupDetails?.groupName,
            "members" : members,
            "schemas": [
                "urn:ietf:params:scim:schemas:core:2.0:Group"
            ]

        };

        /**
         * Create Group API Call.
         */
        createGroup(groupData).then(response => {
            if (response.status === 201) {

                const createdGroup = response.data;
                const rolesList: string[] = [];

                if (groupDetails?.RoleList?.roles) {
                    groupDetails?.RoleList?.roles.forEach(role => {
                        rolesList?.push(role.id);
                    })
                }

                const roleData = {
                    "Operations": [{
                        "op": "add",
                        "value": {
                            "groups": [{
                                "display": createdGroup.displayName,
                                "value": createdGroup.id
                            }]
                        }
                    }],
                    "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
                };

                if (rolesList && rolesList.length > 0) {
                    for (const roleId of rolesList) {
                        updateRole(roleId, roleData)
                            .catch(error => {
                                if (!error.response || error.response.status === 401) {
                                    dispatch(
                                        addAlert({
                                            description: t("adminPortal:components.groups.notifications." +
                                                "createPermission." +
                                                "error.description"),
                                            level: AlertLevels.ERROR,
                                            message: t("adminPortal:components.groups.notifications.createPermission." +
                                                "error.message")
                                        })
                                    );
                                } else if (error.response && error.response.data.detail) {
                                    dispatch(
                                        addAlert({
                                            description: t("adminPortal:components.groups.notifications." +
                                                "createPermission." +
                                                "error.description",
                                                { description: error.response.data.detail }),
                                            level: AlertLevels.ERROR,
                                            message: t("adminPortal:components.groups.notifications.createPermission." +
                                                "error.message")
                                        })
                                    );
                                } else {
                                    dispatch(
                                        addAlert({
                                            description: t("adminPortal:components.groups.notifications." +
                                                "createPermission." +
                                                "genericError.description"),
                                            level: AlertLevels.ERROR,
                                            message: t("adminPortal:components.groups.notifications.createPermission." +
                                                "genericError." +
                                                "message")
                                        })
                                    );
                                }
                            });
                    }
                }

                dispatch(
                    addAlert({
                        description: t("adminPortal:components.groups.notifications.createGroup.success." +
                            "description"),
                        level: AlertLevels.SUCCESS,
                        message: t("adminPortal:components.groups.notifications.createGroup.success." +
                            "message")
                    })
                );
            }

            closeWizard();
            history.push(AppConstants.getPaths().get("GROUP_EDIT").replace(":id", response.data.id));
        }).catch(error => {
            if (!error.response || error.response.status === 401) {
                closeWizard();
                dispatch(
                    addAlert({
                        description: t("adminPortal:components.groups.notifications.createGroup.error.description"),
                        level: AlertLevels.ERROR,
                        message: t("adminPortal:components.groups.notifications.createGroup.error.message")
                    })
                );
            } else if (error.response && error.response.data.detail) {
                closeWizard();
                dispatch(
                    addAlert({
                        description: t("adminPortal:components.groups.notifications.createGroup.error.description",
                                { description: error.response.data.detail }),
                        level: AlertLevels.ERROR,
                        message: t("adminPortal:components.groups.notifications.createGroup.error.message")
                    })
                );
            } else {
                closeWizard();
                dispatch(addAlert({
                    description: t("adminPortal:components.groups.notifications.createGroup.genericError.description"),
                    level: AlertLevels.ERROR,
                    message: t("adminPortal:components.groups.notifications.createGroup.genericError.message")
                }));
            }
        });
    };

    /**
     * Method to handle the create group wizard finish action.
     *
     */
    const handleGroupWizardFinish = () => {
        addGroup(wizardState)
    };

    /**
     * Generates a summary of the wizard.
     *
     * @return {any}
     */
    const generateWizardSummary = () => {
        if (!wizardState) {
            return;
        }

        return wizardState;
    };

    /**
     * Handles wizard step submit.
     *
     * @param values - Forms values to be stored in state.
     * @param {WizardStepsFormTypes} formType - Type of the form.
     */
    const handleWizardSubmit = (values: any, formType: WizardStepsFormTypes) => {
        if (WizardStepsFormTypes.BASIC_DETAILS === formType) {
            setSelectedUserStore(values.domain);
        }

        if (!isEnded) {
            setCurrentWizardStep(currentStep + 1);
        }

        setWizardState({ ...wizardState, [ formType ]: values });
    };

    const handleViewRolePermission = () => {
        setViewRolePermissions(!viewRolePermissions);
        setRoleSelection(false);
    };

    // Create group wizard steps
    const WIZARD_STEPS = [{
        content: (
            <GroupBasics
                data-testid="add-group-form"
                triggerSubmit={ submitGeneralSettings }
                initialValues={ wizardState && wizardState[ WizardStepsFormTypes.BASIC_DETAILS ] }
                onSubmit={ (values) => handleWizardSubmit(values, WizardStepsFormTypes.BASIC_DETAILS) }
            />
        ),
        icon: GroupsWizardStepIcons.general,
        title: t("adminPortal:components.roles.addRoleWizard.wizardSteps.0")
    },{
        content: (
            <AddGroupUsers
                data-testid="new-group"
                isEdit={ false }
                triggerSubmit={ submitGroupUserList }
                userStore={ selectedUserStore }
                initialValues={ wizardState && wizardState[ WizardStepsFormTypes.USER_LIST ] }
                onSubmit={ (values) => handleWizardSubmit(values, WizardStepsFormTypes.USER_LIST) }
            />
        ),
        icon: GroupsWizardStepIcons.users,
        title: t("adminPortal:components.roles.addRoleWizard.wizardSteps.2")
    },{
        content: (
            viewRolePermissions
                ? <RolePermissions
                    data-testid={ `${ testId }-group-permission` }
                    handleNavigateBack={ handleViewRolePermission }
                    roleId={ selectedRoleId }
                />
                : <AssignRoles
                    triggerSubmit={ submitRoleList }
                    onSubmit={ (values) => handleWizardSubmit(values, WizardStepsFormTypes.ROLE_LIST) }
                    initialValues={
                        {
                            initialRoleList: initialRoleList,
                            initialTempRoleList: initialTempRoleList,
                            roleList: roleList,
                            tempRoleList: tempRoleList
                        }
                    }
                    handleRoleListChange={ (roles) => handleRoleListChange(roles) }
                    handleTempListChange={ (roles) => handleAddedRoleListChange(roles) }
                    handleInitialTempListChange={ (roles) => handleAddedRoleInitialListChange(roles) }
                    handleInitialRoleListChange={ (roles) => handleInitialRoleListChange(roles) }
                    handleSetRoleId={ (roleId) => handleRoleIdSet(roleId) }
                />
        ),
        icon: GroupsWizardStepIcons.roles,
        title: t("adminPortal:components.roles.addRoleWizard.wizardSteps.5")
    },{
        content: (
            <CreateGroupSummary
                data-testid="add-group-summary"
                triggerSubmit={ finishSubmit }
                onSubmit={ handleGroupWizardFinish }
                summary={ generateWizardSummary() }
            />
        ),
        icon: GroupsWizardStepIcons.summary,
        title: t("adminPortal:components.roles.addRoleWizard.wizardSteps.3")
    }];

    /**
     * Function to change the current wizard step to next.
     */
    const changeStepToNext = (): void => {
        switch(currentStep) {
            case 0:
                setSubmitGeneralSettings();
                break;
            case 1:
                setSubmitGroupUserList();
                break;
            case 2:
                setSubmitRoleList();
                break;
            case 3:
                setFinishSubmit();
                break;

        }
    };

    const navigateToPrevious = () => {
        setPartiallyCompletedStep(currentStep);
    };

    const handleFinishFlow = () => {
        setEnded(true);
        setSubmitGeneralSettings();
    };

    return (
        <Modal
            open={ true }
            className="wizard create-role-wizard"
            dimmer="blurring"
            size="small"
            onClose={ closeWizard }
            closeOnDimmerClick={ false }
            closeOnEscape= { false }
            data-testid={ testId }
        >
            <Modal.Header className="wizard-header">
                {
                    t("adminPortal:components.roles.addRoleWizard.heading", { type: "Group" })
                }
                <Heading as="h6">
                    {
                        t("adminPortal:components.roles.addRoleWizard.subHeading", { type: "group" })
                    }
                </Heading>
            </Modal.Header>
            <Modal.Content className="steps-container">
                <Steps.Group
                    current={ currentStep }
                >
                    { WIZARD_STEPS.map((step, index) => (
                        <Steps.Step
                            key={ index }
                            icon={ step.icon }
                            title={ step.title }
                        />
                    )) }
                </Steps.Group>
            </Modal.Content>
            <Modal.Content className="content-container" scrolling>
                { WIZARD_STEPS[ currentStep ].content }
            </Modal.Content>
            <Modal.Actions>
                <Grid>
                    <Grid.Row column={ 1 }>
                        <Grid.Column mobile={ 8 } tablet={ 8 } computer={ 8 }>
                            <LinkButton
                                floated="left"
                                onClick={ () => closeWizard() }
                                data-testid={ `${ testId }-cancel-button` }
                            >
                                { t("common:cancel") }
                            </LinkButton>
                        </Grid.Column>
                        <Grid.Column mobile={ 8 } tablet={ 8 } computer={ 8 }>
                            { currentStep < WIZARD_STEPS.length - 1 && (
                                <PrimaryButton
                                    floated="right"
                                    onClick={ changeStepToNext }
                                    data-testid={ `${ testId }-next-button` }
                                >
                                    { t("adminPortal:components.roles.addRoleWizard.buttons.next") }
                                    <Icon name="arrow right" data-testid={ `${ testId }-next-button-icon` }/>
                                </PrimaryButton>
                            ) }
                            { currentStep === 0 && (
                                    <Button
                                        basic
                                        color="orange"
                                        floated="right"
                                        onClick={ handleFinishFlow }
                                        data-testid={ `${ testId }-initial-finish-button` }
                                    >
                                        { t("adminPortal:components.roles.addRoleWizard.buttons.finish") }
                                    </Button>
                            ) }
                            { currentStep === WIZARD_STEPS.length - 1 && (
                                <PrimaryButton
                                    floated="right"
                                    onClick={ changeStepToNext }
                                    data-testid={ `${ testId }-finish-button` }
                                >
                                    { t("adminPortal:components.roles.addRoleWizard.buttons.finish") }
                                </PrimaryButton>
                            ) }
                            { currentStep > 0 && (
                                <LinkButton
                                    floated="right"
                                    onClick={ navigateToPrevious }
                                    data-testid={ `${ testId }-previous-button` }
                                >
                                    <Icon name="arrow left" data-testid={ `${ testId }-previous-button-icon` }/>
                                    { t("adminPortal:components.roles.addRoleWizard.buttons.previous") }
                                </LinkButton>
                            ) }
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            </Modal.Actions>
        </Modal>
    );
};

/**
 * Default props for Create group wizard component.
 * NOTE : Current step is set to 0 in order to start from
 *        beginning of the wizard.
 */
CreateGroupWizard.defaultProps = {
    initStep: 0
};
