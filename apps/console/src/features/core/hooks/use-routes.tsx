/**
 * Copyright (c) 2023, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
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

import { GearIcon } from "@oxygen-ui/react-icons";
import { AccessControlUtils } from "@wso2is/access-control";
import { ChildRouteInterface, RouteInterface } from "@wso2is/core/models";
import { RouteUtils as CommonRouteUtils } from "@wso2is/core/utils";
import React, { lazy, useMemo } from "react";
import { useSelector } from "react-redux";
import { commonConfig } from "../../../extensions/configs/common";
import { serverConfigurationConfig } from "../../../extensions/configs/server-configuration";
import { OrganizationManagementConstants } from "../../organizations/constants/organization-constants";
import { OrganizationUtils } from "../../organizations/utils/organization";
import { useGovernanceConnectorCategories } from "../../server-configurations/api/governance-connectors";
import {
    GovernanceCategoryForOrgsInterface,
    GovernanceConnectorForOrgsInterface
} from "../../server-configurations/models/governance-connectors";
import { getAppViewRoutes } from "../configs/routes";
import { getSidePanelIcons } from "../configs/ui";
import { AppConstants } from "../constants/app-constants";
import { history } from "../helpers/history";
import { FeatureConfigInterface } from "../models/config";
import { AppState, setDeveloperVisibility, setFilteredDevelopRoutes, setSanitizedDevelopRoutes, store } from "../store";
import { AppUtils } from "../utils/app-utils";
import { DecodedIDTokenPayload, useAuthContext } from "@asgardeo/auth-react";

/**
 * Props interface of {@link useOrganizations}
 */
export type useRoutesInterface = {
    filterRoutes: (isFirstLevelOrg) => void;
    onRoutesFilterComplete: () => void;
};

/**
 * Hook that provides access to the Organizations context.
 *
 * @returns An object containing the current Organizations context.
 */
const useRoutes = (): useRoutesInterface => {
    const { getDecodedIDToken } = useAuthContext();

    const featureConfig: FeatureConfigInterface = useSelector((state: AppState) => state.config.ui.features);
    const loggedUserName: string = useSelector((state: AppState) => state.profile.profileInfo.userName);
    const isSuperAdmin: string = useSelector((state: AppState) => state.organization.superAdmin);
    const isFirstLevelOrg: boolean = useSelector((state: AppState) => state.organization.isFirstLevelOrganization);
    const allowedScopes: string = useSelector((state: AppState) => state?.auth?.allowedScopes);
    const isPrivilegedUser: boolean = useSelector((state: AppState) => state?.auth?.isPrivilegedUser);
    const tenantDomain: string = useSelector((state: AppState) => state.auth.tenantDomain);

    const {
        data: governanceConnectors,
        error: governanceConnectorsFetchRequestError
    } = useGovernanceConnectorCategories(featureConfig?.residentIdp?.enabled && isFirstLevelOrg);

    const onRoutesFilterComplete = (): void => {
        return;
    };

    const filterRoutes = async (_isFirstLevelOrg?, _tenantDomain?, _isPrivilegedUser?): Promise<void> => {
        const resolveHiddenRoutes = (): string[] => {
            const commonHiddenRoutes: string[] = [
                ...AppUtils.getHiddenRoutes(),
                ...AppConstants.ORGANIZATION_ONLY_ROUTES
            ];

            const additionalRoutes: string[] = isOrganizationManagementEnabled
                ? (OrganizationUtils.isCurrentOrganizationRoot() && AppConstants.getSuperTenant() === (_tenantDomain ?? tenantDomain)) ||
                  _isFirstLevelOrg
                    ? isPrivilegedUser
                        ? loggedUserName === isSuperAdmin
                            ? [ ...commonHiddenRoutes, ...AppConstants.ORGANIZATION_ROUTES ]
                            : [
                                ...commonHiddenRoutes,
                                ...AppConstants.ORGANIZATION_ROUTES,
                                ...AppConstants.SUPER_ADMIN_ONLY_ROUTES
                            ]
                        : loggedUserName === isSuperAdmin
                            ? commonHiddenRoutes
                            : [ ...commonHiddenRoutes, ...AppConstants.SUPER_ADMIN_ONLY_ROUTES ]
                    : window["AppUtils"].getConfig().organizationName
                        ? [ ...AppUtils.getHiddenRoutes(), ...OrganizationManagementConstants.ORGANIZATION_ROUTES ]
                        : [ ...AppUtils.getHiddenRoutes(), ...AppConstants.ORGANIZATION_ROUTES ]
                : [ ...AppUtils.getHiddenRoutes(), ...AppConstants.ORGANIZATION_ROUTES ];

            return [ ...additionalRoutes ];
        };

        const [ appRoutes, sanitizedAppRoutes ] = CommonRouteUtils.filterEnabledRoutes<FeatureConfigInterface>(
            getAppViewRoutes(commonConfig.useExtendedRoutes),
            featureConfig,
            allowedScopes,
            window["AppUtils"].getConfig().organizationName ? false : commonConfig.checkForUIResourceScopes,
            resolveHiddenRoutes(),
            !OrganizationUtils.isCurrentOrganizationRoot() &&
                !_isFirstLevelOrg &&
                AppConstants.ORGANIZATION_ENABLED_ROUTES
        );

        // TODO : Remove this logic once getting started pages are removed.
        if (
            appRoutes.length === 2 &&
            appRoutes.filter(
                (route: RouteInterface) =>
                    route.id === AccessControlUtils.DEVELOP_GETTING_STARTED_ID || route.id === "404"
            ).length === 2
        ) {
            appRoutes[0] = appRoutes[0].filter((route: RouteInterface) => route.id === "404");
        }

        store.dispatch(setFilteredDevelopRoutes(appRoutes));

        if (governanceConnectors?.length > 0) {
            const customGovernanceConnectorRoutes: RouteInterface[] = [];

            governanceConnectors.forEach((category: GovernanceCategoryForOrgsInterface) => {
                if (!serverConfigurationConfig.connectorCategoriesToShow.includes(category.id)) {
                    const governanceConnectorChildren: ChildRouteInterface[] = [];

                    category?.connectors?.forEach((connector: GovernanceConnectorForOrgsInterface) => {
                        governanceConnectorChildren.push({
                            component: lazy(() => import("../../server-configurations/pages/connector-edit-page")),
                            exact: true,
                            icon: {
                                icon: getSidePanelIcons().childIcon
                            },
                            id: connector.id,
                            name: connector.name,
                            path: AppConstants.getPaths()
                                .get("GOVERNANCE_CONNECTOR_EDIT")
                                .replace(":categoryId", category.id)
                                .replace(":connectorId", connector.id),
                            protected: true,
                            showOnSidePanel: false
                        });
                    });

                    customGovernanceConnectorRoutes.push({
                        category: category.id,
                        children: governanceConnectorChildren,
                        component: lazy(() => import("../../server-configurations/pages/connector-listing-page")),
                        exact: true,
                        icon: {
                            icon: <GearIcon />
                        },
                        id: category.id,
                        name: category.name,
                        path: AppConstants.getPaths()
                            .get("GOVERNANCE_CONNECTOR")
                            .replace(":id", category.id),
                        protected: true,
                        showOnSidePanel: true
                    });
                }
            });

            appRoutes.push(...customGovernanceConnectorRoutes);
            sanitizedAppRoutes.push(...customGovernanceConnectorRoutes);
        }

        store.dispatch(setFilteredDevelopRoutes(appRoutes));
        store.dispatch(setSanitizedDevelopRoutes(sanitizedAppRoutes));

        onRoutesFilterComplete();

        if (sanitizedAppRoutes.length < 1) {
            store.dispatch(setDeveloperVisibility(false));
        }

        if (sanitizedAppRoutes.length < 1) {
            history.push({
                pathname: AppConstants.getPaths().get("UNAUTHORIZED"),
                search: "?error=" + AppConstants.LOGIN_ERRORS.get("ACCESS_DENIED")
            });
        }

        const idToken: DecodedIDTokenPayload = await getDecodedIDToken();
        const orgIdIdToken: string = idToken.org_id;

        console.log('SWITCHED')
        console.log('SWITCHED:::orgIdIdToken', orgIdIdToken)
    };

    return {
        filterRoutes,
        onRoutesFilterComplete
    };
};

export default useRoutes;
