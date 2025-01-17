/* global cy */

import { createDashboard, createQuery } from '../../support/redash-api';
import { createQueryAndAddWidget, editDashboard, resizeBy } from '../../support/dashboard';

describe('Widget', () => {
  beforeEach(function () {
    cy.login();
    createDashboard('Foo Bar').then(({ slug, id }) => {
      this.dashboardId = id;
      this.dashboardUrl = `/dashboard/${slug}`;
    });
  });

  it('adds widget', function () {
    createQuery().then(({ id: queryId }) => {
      cy.visit(this.dashboardUrl);
      editDashboard();
      cy.contains('a', 'Add Widget').click();
      cy.getByTestId('AddWidgetDialog').within(() => {
        cy.get(`.query-selector-result[data-test="QueryId${queryId}"]`).click();
      });
      cy.contains('button', 'Add to Dashboard').click();
      cy.getByTestId('AddWidgetDialog').should('not.exist');
      cy.get('.widget-wrapper').should('exist');
    });
  });

  it('removes widget', function () {
    createQueryAndAddWidget(this.dashboardId).then((elTestId) => {
      cy.visit(this.dashboardUrl);
      editDashboard();
      cy.getByTestId(elTestId)
        .within(() => {
          cy.get('.widget-menu-remove').click();
        })
        .should('not.exist');
    });
  });

  describe('Auto height for table visualization', () => {
    it('renders correct height for 2 table rows', function () {
      const queryData = {
        query: 'select s.a FROM generate_series(1,2) AS s(a)',
      };

      createQueryAndAddWidget(this.dashboardId, queryData).then((elTestId) => {
        cy.visit(this.dashboardUrl);
        cy.getByTestId(elTestId)
          .its('0.offsetHeight')
          .should('eq', 235);
      });
    });

    it('renders correct height for 5 table rows', function () {
      const queryData = {
        query: 'select s.a FROM generate_series(1,5) AS s(a)',
      };

      createQueryAndAddWidget(this.dashboardId, queryData).then((elTestId) => {
        cy.visit(this.dashboardUrl);
        cy.getByTestId(elTestId)
          .its('0.offsetHeight')
          .should('eq', 335);
      });
    });

    describe('Height behavior on refresh', () => {
      const paramName = 'count';
      const queryData = {
        query: `select s.a FROM generate_series(1,{{ ${paramName} }}) AS s(a)`,
        options: {
          parameters: [{
            title: paramName,
            name: paramName,
            type: 'text',
          }],
        },
      };

      beforeEach(function () {
        createQueryAndAddWidget(this.dashboardId, queryData).then((elTestId) => {
          cy.visit(this.dashboardUrl);
          cy.getByTestId(elTestId).as('widget').within(() => {
            cy.getByTestId('RefreshIndicator').as('refreshButton');
          });
          cy.getByTestId(`ParameterName-${paramName}`).within(() => {
            cy.getByTestId('TextParamInput').as('paramInput');
          });
        });
      });

      it('grows when dynamically adding table rows', () => {
        // listen to results
        cy.server();
        cy.route('GET', 'api/query_results/*').as('FreshResults');

        // start with 1 table row
        cy.get('@paramInput').clear().type('1');
        cy.getByTestId('ParameterApplyButton').click();
        cy.wait('@FreshResults', { timeout: 10000 });
        cy.get('@widget').invoke('height').should('eq', 285);

        // add 4 table rows
        cy.get('@paramInput').clear().type('5');
        cy.getByTestId('ParameterApplyButton').click();
        cy.wait('@FreshResults', { timeout: 10000 });

        // expect to height to grow by 1 grid grow
        cy.get('@widget').invoke('height').should('eq', 435);
      });

      it('revokes auto height after manual height adjustment', () => {
        // listen to results
        cy.server();
        cy.route('GET', 'api/query_results/*').as('FreshResults');

        editDashboard();

        // start with 1 table row
        cy.get('@paramInput').clear().type('1');
        cy.getByTestId('ParameterApplyButton').click();
        cy.wait('@FreshResults');
        cy.get('@widget').invoke('height').should('eq', 285);

        // resize height by 1 grid row
        resizeBy(cy.get('@widget'), 0, 50)
          .then(() => cy.get('@widget'))
          .invoke('height')
          .should('eq', 335); // resized by 50, , 135 -> 185

        // add 4 table rows
        cy.get('@paramInput').clear().type('5');
        cy.getByTestId('ParameterApplyButton').click();
        cy.wait('@FreshResults');

        // expect height to stay unchanged (would have been 435)
        cy.get('@widget').invoke('height').should('eq', 335);
      });
    });
  });
});
