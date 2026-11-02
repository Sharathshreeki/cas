# Software Requirements Specification (SRS)
## PES University Canteen Automation System

**Document type:** Software Requirements Specification  
**Version:** 1.0 — Proposed requirements baseline  
**Application:** Web-based campus canteen ordering and management system  
**Technology stack:** Next.js, Prisma ORM, PostgreSQL, and Python-based ML services (proposed)  
**Primary user roles:** Students, canteen staff, and administrator  
**Machine-learning capabilities:** Food demand forecasting and food recommendations

> **Document status:** Proposed SRS. Before final submission, verify each feature against the application actually implemented. Distinguish implemented functionality from planned or optional integrations.

---

# 1. Introduction

## 1.1 Purpose

This document defines the functional and non-functional requirements of the PES University Canteen Automation System. It establishes expected system behavior, user roles, constraints, interfaces, data requirements, and quality standards to guide development, testing, deployment, and evaluation. It serves as a reference for the project developer, project guide, testers, and evaluators.

## 1.2 Scope

The system provides a centralized digital platform for campus canteen operations. Students can browse available food items, place orders, select pickup slots, and track order status. Canteen staff can manage menus, availability, and order preparation. Administrators oversee users, stalls, and system operations.

The system includes two planned machine-learning capabilities:

- **Food demand forecasting:** Estimate future demand for menu items to support preparation planning and reduce food waste.
- **Food recommendations:** Suggest relevant menu items using order history, item popularity, and available menu data.

The system aims to improve ordering convenience, reduce queues, improve order coordination, and support data-driven canteen management.

## 1.3 Objectives

1. Digitize food ordering within the university campus.
2. Reduce student waiting time and congestion at canteen counters.
3. Enable advance ordering and structured pickup scheduling.
4. Provide staff with centralized order and menu management.
5. Use historical order data to estimate future food demand.
6. Provide relevant menu recommendations based on available data.
7. Maintain accurate records of orders, payments, and order status.
8. Provide administrators with operational oversight and reports.

## 1.4 Definitions and Abbreviations

| Term | Definition |
|---|---|
| SRS | Software Requirements Specification |
| ML | Machine Learning |
| ORM | Object-Relational Mapping |
| UI | User Interface |
| API | Application Programming Interface |
| Pickup slot | A designated time interval for collecting an order |
| Demand forecasting | Estimating future quantities of food items required |
| Recommendation system | A mechanism for suggesting suitable menu items |
| Geo-fencing | Validating access according to a geographical boundary |
| RBAC | Role-Based Access Control |
| MAE | Mean Absolute Error |

# 2. Overall Description

## 2.1 Product Perspective

The application is a web-based information system with a student-facing interface, staff-facing operational interface, administrative interface, relational database, and ML component.

### Proposed logical architecture

```text
+---------------------------------------------+
|                 User Interfaces             |
|       Student | Canteen Staff | Admin       |
+---------------------------------------------+
                      |
                      v
+---------------------------------------------+
|          Next.js Application / API          |
| Authentication | Authorization | Ordering  |
| Scheduling | Menu Management | Reporting    |
+---------------------------------------------+
             |                    |
             v                    v
+------------------------+  +------------------+
|      PostgreSQL        |  |    ML Services   |
| Users, Stalls, Menus,  |  | Demand Forecast  |
| Orders, Items, Slots   |  | Recommendations  |
+------------------------+  +------------------+
```

This architecture is logical rather than a claim that every component is already implemented. The ML service may initially be integrated as Python scripts or API endpoints and deployed separately later.

## 2.2 Product Functions

- Registration, login, logout, and role-based access.
- Stall discovery and menu browsing.
- Food search, item details, prices, and availability.
- Cart management and order placement.
- Pickup-slot selection and capacity management.
- Order status updates and order history.
- Payment recording and payment-status tracking.
- Stall menu and order administration.
- Administrative user and stall management.
- Demand forecasting and food recommendations.
- Reports on orders, sales, item popularity, and estimated demand.
- Campus-location validation, if supported by the deployment environment.

## 2.3 User Classes

| User class | Responsibilities |
|---|---|
| Student | Browse menus, manage cart, place orders, select pickup slots, track orders, and view history |
| Canteen staff | Manage assigned stall menu, item availability, incoming orders, preparation, and handover |
| Administrator | Manage accounts, roles, stalls, system configuration, and reports |
| ML component | Generate demand forecasts and recommendations from permitted application data |

## 2.4 Operating Environment

- Modern browsers on laptops, desktops, tablets, and smartphones.
- Next.js web application and a compatible hosting environment.
- PostgreSQL database accessed through Prisma ORM.
- Python-compatible runtime for ML training and inference, if Python is selected.
- Internet or campus-network connectivity.

## 2.5 Design and Implementation Constraints

1. PostgreSQL is the primary relational database; Prisma manages access and migrations.
2. Permissions must be enforced server-side, not only in the UI.
3. Each staff account manages its assigned stall under the current project scope.
4. Pickup-slot capacity must be configurable or managed under a defined operational rule.
5. ML performance depends on the quantity and quality of order data.
6. Payment gateway, university identity, and GPS geo-fencing integrations require suitable external services and are not assumed available by default.

# 3. Functional Requirements

Functional requirements define what the system must do. Requirement IDs can be referenced in implementation tasks, test cases, and project evaluation.

Priority definitions:

- **Must:** Required for the core system.
- **Should:** Recommended functionality, subject to project scope.

## 3.1 Authentication and User Management

| ID | Functional requirement | Priority |
|---|---|---|
| FR-01 | Allow students to register using required identity and contact information. | Must |
| FR-02 | Validate registration fields and prevent duplicate accounts based on configured unique identifiers. | Must |
| FR-03 | Authenticate registered users using valid login credentials. | Must |
| FR-04 | Allow authenticated users to log out securely. | Must |
| FR-05 | Provide role-based access for students, canteen staff, and administrators. | Must |
| FR-06 | Allow users to view and update permitted profile information. | Should |
| FR-07 | Restrict staff accounts to their assigned stall and permitted operations. | Must |
| FR-08 | Allow authorized administrators to activate, deactivate, or manage accounts. | Should |
| FR-09 | Show suitable errors for invalid credentials and input without exposing sensitive information. | Must |

## 3.2 Stall Discovery and Menu Management

| ID | Functional requirement | Priority |
|---|---|---|
| FR-10 | Display registered canteen stalls. | Must |
| FR-11 | Display stall name, description, and operating status where available. | Must |
| FR-12 | Display the menu associated with a selected stall. | Must |
| FR-13 | Display each item's name, description, price, and availability. | Must |
| FR-14 | Allow students to search or filter menu items. | Should |
| FR-15 | Allow authorized staff to add menu items. | Must |
| FR-16 | Allow authorized staff to edit item name, price, and preparation time. | Must |
| FR-17 | Allow staff to mark items available or unavailable. | Must |
| FR-18 | Prevent unauthorized menu modification. | Must |
| FR-19 | Allow administrators to manage stalls and operating status. | Should |

## 3.3 Cart Management

| ID | Functional requirement | Priority |
|---|---|---|
| FR-20 | Allow students to add available menu items to the cart. | Must |
| FR-21 | Allow students to increase or decrease item quantities. | Must |
| FR-22 | Allow students to remove cart items. | Must |
| FR-23 | Calculate item subtotals and order total using current valid prices. | Must |
| FR-24 | Validate item availability and price before accepting an order. | Must |
| FR-25 | Reject invalid quantities such as zero or negative values. | Must |
| FR-26 | Enforce the configured rule for single-stall or multi-stall carts. | Must |

## 3.4 Order Processing and Tracking

| ID | Functional requirement | Priority |
|---|---|---|
| FR-27 | Allow authenticated students to place orders containing valid cart items. | Must |
| FR-28 | Generate a unique identifier for every accepted order. | Must |
| FR-29 | Record order details, item quantities, purchase-time prices, total, and timestamps. | Must |
| FR-30 | Associate each order with its student and relevant stall. | Must |
| FR-31 | Allow students to view current and previous orders. | Must |
| FR-32 | Display current order status to the student. | Must |
| FR-33 | Allow staff to view orders assigned to their stall. | Must |
| FR-34 | Allow staff to update order status through permitted transitions. | Must |
| FR-35 | Maintain consistent status-change records and timestamps. | Should |
| FR-36 | Validate cancellation requests against the configured policy. | Should |
| FR-37 | Prevent duplicate order creation on request retry where idempotency is implemented. | Should |

Recommended order lifecycle:

```text
Placed
  |
  v
Accepted
  |
  v
Preparing
  |
  v
Ready for Pickup
  |
  v
Completed
```

Cancellation or rejection should be handled as separate permitted outcomes. The system must validate status transitions and store relevant timestamps.

## 3.5 Pickup-Slot Management

The proposed design divides each hour into four 15-minute slots.

| ID | Functional requirement | Priority |
|---|---|---|
| FR-38 | Display available pickup slots for the selected stall and date. | Must |
| FR-39 | Allow students to select a valid pickup slot during checkout. | Must |
| FR-40 | Associate each accepted order with its selected pickup slot. | Must |
| FR-41 | Enforce configured capacity for each slot. | Must |
| FR-42 | Prevent overbooking when simultaneous users attempt to reserve remaining capacity. | Must |
| FR-43 | Allow authorized staff to configure slot capacity where permitted. | Should |
| FR-44 | Reject unavailable, expired, or invalid slots. | Must |
| FR-45 | Update slot availability consistently when orders are accepted or cancelled. | Must |
| FR-46 | Display the selected pickup time in order confirmation. | Must |

**Capacity decision:** A 15-minute slot does not automatically mean it can accept unlimited orders. Define capacity as a maximum number of orders, a maximum number of items, or a workload limit based on preparation time. The selected model must be implemented consistently.

## 3.6 Payment Management

| ID | Functional requirement | Priority |
|---|---|---|
| FR-47 | Display the amount payable before order confirmation. | Must |
| FR-48 | Maintain a payment status for each order. | Must |
| FR-49 | Support project-selected payment methods, such as cash or an integrated digital method. | Must |
| FR-50 | Record amount, method, status, and transaction reference where applicable. | Must |
| FR-51 | Handle failed, pending, and successful payment outcomes without marking unpaid orders paid. | Must |
| FR-52 | Restrict payment-status changes to authorized workflows. | Must |

For a prototype, cash-on-pickup or simulated payment can be used. A real online payment gateway should only be claimed as implemented when it is integrated and tested.

## 3.7 Staff Dashboard

| ID | Functional requirement | Priority |
|---|---|---|
| FR-53 | Provide a staff dashboard for the assigned stall. | Must |
| FR-54 | Display orders grouped or filtered by status. | Must |
| FR-55 | Show order items, quantities, pickup time, and relevant details. | Must |
| FR-56 | Allow staff to update menu availability. | Must |
| FR-57 | Display upcoming pickup orders for preparation planning. | Should |
| FR-58 | Provide daily order and sales summaries where payment data is available. | Should |
| FR-59 | Display demand forecasts when valid predictions are available. | Should |

## 3.8 Administrator Dashboard

| ID | Functional requirement | Priority |
|---|---|---|
| FR-60 | Provide an administrator interface accessible only to authorized administrators. | Must |
| FR-61 | Allow administrators to manage stalls and assignments. | Must |
| FR-62 | Allow administrators to manage roles and account status. | Must |
| FR-63 | Provide system-level order and operational summaries. | Should |
| FR-64 | Allow authorized administrators to configure system settings and slot policies. | Should |
| FR-65 | Record important administrative actions for auditing where enabled. | Should |

## 3.9 Food Demand Forecasting — ML Module 1

This module uses historical canteen order data to estimate future demand for individual menu items. Forecasts support staff preparation planning; they do not automatically create orders or guarantee actual demand.

| ID | Functional requirement | Priority |
|---|---|---|
| FR-66 | Collect and retain order data required for demand analysis. | Must |
| FR-67 | Aggregate historical quantities sold for menu items over defined time intervals. | Must |
| FR-68 | Generate forecasts for selected items and future periods. | Must |
| FR-69 | Display forecasted quantities to authorized staff. | Must |
| FR-70 | Identify the forecasting period and unit for each prediction. | Must |
| FR-71 | Evaluate forecasting performance using a suitable metric, such as MAE. | Should |
| FR-72 | Use an explicit baseline or indicate that a reliable forecast is unavailable when data is insufficient. | Must |
| FR-73 | Support model retraining or updating as new order data becomes available. | Should |
| FR-74 | Retain model version and forecast-generation time for evaluation. | Should |

### Proposed demand forecasting workflow

```text
Historical Order Data
        |
        v
Data Extraction
        |
        v
Data Cleaning and Preprocessing
        |
        v
Feature Engineering
        |
        v
ML Forecasting Model
        |
        v
Predicted Demand by Menu Item
        |
        v
Staff Dashboard
        |
        v
Preparation Planning
```

### Proposed input features

- Menu item identifier.
- Quantity ordered or sold.
- Order date.
- Day of week.
- Time of day or pickup interval.
- Stall identifier.
- Item availability, if recorded.
- Relevant calendar or event indicators, if available and appropriate.

### Proposed output

The forecasting module should return:

- Menu item.
- Forecast date.
- Forecast time interval or aggregation period.
- Predicted quantity.
- Model version.
- Forecast generation timestamp.

### Candidate algorithms

The SRS does not mandate a specific algorithm. Candidate approaches include:

1. Historical mean or seasonal-naive baseline.
2. Random Forest Regressor.
3. Gradient boosting models such as XGBoost or LightGBM.
4. Time-series models where sufficient chronological data is available.

The final algorithm should be selected using validation results, data volume, interpretability, and operational constraints.

### Forecast evaluation

Mean Absolute Error (MAE) is a suitable initial metric:

\[
MAE = \frac{1}{n}\sum_{i=1}^{n}|y_i-\hat{y}_i|
\]

Where:

- \(y_i\) is actual demand.
- \(\hat{y}_i\) is predicted demand.
- \(n\) is the number of evaluated observations.

Use chronological train/validation/test splits for time-dependent forecasting. Avoid using future information when creating training features.

## 3.10 Food Recommendations — ML Module 2

| ID | Functional requirement | Priority |
|---|---|---|
| FR-75 | Display recommended menu items to students. | Must |
| FR-76 | Generate recommendations from eligible menu items using available data. | Must |
| FR-77 | Support popularity-based recommendations when personal history is insufficient. | Must |
| FR-78 | Use eligible order history to personalize recommendations when sufficient data exists. | Should |
| FR-79 | Exclude unavailable items from recommendations intended for immediate purchase. | Must |
| FR-80 | Allow students to open a recommended item and add it to the cart if available. | Must |
| FR-81 | Provide fallback recommendations for new users or items with insufficient history. | Must |
| FR-82 | Evaluate recommendation quality using suitable metrics or a documented procedure. | Should |

Initial recommendations can be popularity-based because the system does not yet have real order-history data. Personalization can be introduced after sufficient interactions have accumulated.

## 3.11 Location-Aware Access

| ID | Functional requirement | Priority |
|---|---|---|
| FR-83 | Support campus-location validation if geo-fencing is enabled. | Should |
| FR-84 | Evaluate ordering eligibility against the configured campus boundary and policy. | Should |
| FR-85 | Handle unavailable or denied location permission without exposing sensitive location data. | Must if implemented |
| FR-86 | Explain when ordering is blocked by a location-based requirement. | Should |

Browser-provided location can be inaccurate or manipulated. Location validation should not be treated as proof of identity. A stronger restriction may require university authentication or another approved campus-access mechanism.

## 3.12 Reporting and Notifications

| ID | Functional requirement | Priority |
|---|---|---|
| FR-87 | Provide order summaries for selected periods to authorized users. | Should |
| FR-88 | Calculate sales summaries from valid transaction records under the reporting policy. | Should |
| FR-89 | Provide item-level sales and demand summaries. | Should |
| FR-90 | Inform students of important order-status changes. | Should |
| FR-91 | Inform staff of new orders through the dashboard or configured mechanism. | Should |
| FR-92 | Distinguish actual sales, historical quantities, and ML-generated forecasts in reports. | Must |

Notifications may initially be implemented as dashboard updates. SMS, email, or push notifications require additional configuration and services.

# 4. Non-Functional Requirements

Non-functional requirements specify how well the system must operate, including performance, security, usability, reliability, and maintainability.

The numerical targets below are proposed acceptance targets for the capstone. They must be validated on the actual deployment environment rather than presented as measured results.

## 4.1 Performance and Response Time

| ID | Non-functional requirement |
|---|---|
| NFR-01 | 95% of page/API responses should complete within 3 seconds under the defined test load. |
| NFR-02 | 95% of menu browsing and search requests should complete within 2 seconds under the defined test load. |
| NFR-03 | 95% of order-placement requests should complete within 3 seconds, excluding external payment delays. |
| NFR-04 | Demonstrate at least 50 concurrent simulated users in a defined load test. |
| NFR-05 | ML operations shall have defined timeouts and fallback behavior and shall not unnecessarily block ordering. |

## 4.2 Security

| ID | Non-functional requirement |
|---|---|
| NFR-06 | Store passwords using an appropriate secure password-hashing algorithm; never store plaintext passwords. |
| NFR-07 | Enforce authentication and role-based authorization on the server. |
| NFR-08 | Students may access only their own private order and profile records. |
| NFR-09 | Staff may access only their assigned stall's data, except explicitly authorized administration. |
| NFR-10 | Validate input and use safe database access patterns to reduce injection and input-based attacks. |
| NFR-11 | Keep database credentials, authentication secrets, and payment secrets out of client-side code and source control. |
| NFR-12 | Use HTTPS for sensitive traffic in production. |
| NFR-13 | Use secure session handling and appropriate cookie protections if cookie-based authentication is selected. |
| NFR-14 | Log relevant security and administrative events without recording passwords, tokens, or unnecessary secrets. |
| NFR-15 | Verify payment outcomes through trusted server-side mechanisms if payment integration is implemented. |

## 4.3 Reliability and Availability

| ID | Non-functional requirement |
|---|---|
| NFR-16 | Preserve data consistency during order creation and slot booking; concurrent capacity races must not create overbooking. |
| NFR-17 | Commit order creation and related item records atomically. |
| NFR-18 | Handle temporary external-service failures with clear errors and controlled retry or fallback. |
| NFR-19 | Reject invalid order-state transitions. |
| NFR-20 | Maintain a documented database backup and restoration procedure and test restoration. |
| NFR-21 | Do not expose raw stack traces or secrets in user-facing error messages. |

## 4.4 Usability and Accessibility

| ID | Non-functional requirement |
|---|---|
| NFR-22 | The interface shall be understandable to users with basic web and smartphone skills. |
| NFR-23 | Navigation shall be consistent across student, staff, and administrator interfaces. |
| NFR-24 | Forms shall identify required fields and explain validation errors. |
| NFR-25 | Order totals, pickup slots, payment status, and order status shall be clearly visible. |
| NFR-26 | Provide loading, empty, success, and error states. |
| NFR-27 | Support keyboard navigation and appropriate accessible labels for interactive elements. |
| NFR-28 | Use sufficient text contrast and do not rely on color alone to communicate status. |

## 4.5 Compatibility and Responsiveness

| ID | Non-functional requirement |
|---|---|
| NFR-29 | Support current stable versions of major browsers, including Chrome, Edge, Firefox, and Safari. |
| NFR-30 | Adapt the interface to mobile, tablet, and desktop screen sizes. |
| NFR-31 | Keep core ordering workflows usable on typical smartphone screens. |
| NFR-32 | Use responsive layouts and appropriately sized interactive controls. |

## 4.6 Maintainability and Extensibility

| ID | Non-functional requirement |
|---|---|
| NFR-33 | Separate UI components, business logic, database access, and ML logic into maintainable modules. |
| NFR-34 | Manage database schema changes through version-controlled Prisma migrations. |
| NFR-35 | Manage configuration and secrets outside source code. |
| NFR-36 | Document and test important business rules, including slot capacity and order-status transitions. |
| NFR-37 | Support future additions such as stalls, payment methods, and improved ML models without a complete redesign. |
| NFR-38 | Provide setup instructions and document required environment variables. |

## 4.7 Data Integrity and Consistency

| ID | Non-functional requirement |
|---|---|
| NFR-39 | Use appropriate primary keys for database records requiring identity. |
| NFR-40 | Enforce valid relationships among students, stalls, orders, menu items, order items, and pickup slots. |
| NFR-41 | Use suitable numeric types and validation for prices, totals, and quantities. |
| NFR-42 | Preserve item prices at the time of purchase in historical order records. |
| NFR-43 | Prevent invalid references and unintended duplicates using suitable constraints. |
| NFR-44 | Preserve slot capacity and transaction consistency during concurrent operations. |
| NFR-45 | Use a consistent timestamp storage convention and configured local time zone for display. |

## 4.8 Privacy

| ID | Non-functional requirement |
|---|---|
| NFR-46 | Collect only personal data needed for the stated functions. |
| NFR-47 | Do not expose a student's private order history to other students. |
| NFR-48 | Process location data only for the defined purpose if location is used. |
| NFR-49 | Limit ML training data to fields needed for the selected task. |
| NFR-50 | Define retention and deletion rules for personal and operational records. |
| NFR-51 | Provide an appropriate privacy notice describing collected data and its intended use. |

## 4.9 Machine-Learning Quality

| ID | Non-functional requirement |
|---|---|
| NFR-52 | Evaluate forecasting against a documented baseline using a suitable error metric. |
| NFR-53 | Evaluate recommendations with an appropriate offline metric or defined testing procedure. |
| NFR-54 | Separate training and evaluation data appropriately to reduce data leakage. |
| NFR-55 | Identify item, forecast period, predicted quantity, and generation time for forecasts. |
| NFR-56 | Provide a defined fallback when a model fails, is unavailable, or lacks adequate data. |
| NFR-57 | Do not present ML outputs as guaranteed future demand or guaranteed preferences. |
| NFR-58 | Reassess model performance as additional order data becomes available. |

For time-dependent demand forecasting, evaluation should preserve chronological order rather than randomly mixing future records into training data.

## 4.10 Scalability

| ID | Non-functional requirement |
|---|---|
| NFR-59 | Support additional stalls and menu items in the database design. |
| NFR-60 | Index frequently queried fields when justified by query patterns and performance testing. |
| NFR-61 | Support increasing order volumes without compromising transaction integrity. |
| NFR-62 | Allow ML training and inference to run separately from the primary ordering workflow when required. |

# 5. Business Rules

| ID | Business rule |
|---|---|
| BR-01 | Only authenticated and authorized students may place orders. |
| BR-02 | Each order must be associated with its student and relevant stall. |
| BR-03 | Only available menu items may be purchased. |
| BR-04 | The server calculates the final order total using validated prices and quantities. |
| BR-05 | An order must have a valid pickup slot when scheduling is required. |
| BR-06 | A pickup slot must not exceed its configured capacity. |
| BR-07 | Staff may manage only their assigned stall under the proposed access policy. |
| BR-08 | Order statuses may change only through permitted transitions. |
| BR-09 | Historical item prices must not change when menu prices are updated later. |
| BR-10 | Payment is marked successful only after the configured process confirms success. |
| BR-11 | Immediate-purchase recommendations must exclude unavailable items. |
| BR-12 | Forecasted demand must be distinguishable from actual quantities sold. |
| BR-13 | New users and items with insufficient history use an appropriate fallback strategy. |
| BR-14 | ML forecasts must not automatically create orders or authorize purchases. |
| BR-15 | Cancellation, refunds, and capacity release follow the configured policy. |

# 6. System Use Cases

## 6.1 UC-01 — Place Food Order

- **Primary actor:** Student.
- **Preconditions:** Student is authenticated; items and pickup slot are eligible.
- **Main flow:**
  1. Student browses stalls.
  2. Student selects a stall and adds items.
  3. System calculates the order total.
  4. Student selects an available pickup slot.
  5. System validates prices, availability, capacity, and payment rules.
  6. System creates the order and item records in a consistent transaction.
  7. System displays confirmation and status.
- **Alternative flows:** If an item is unavailable, ask the student to update the cart. If a slot is full, ask for another slot. If payment fails, follow the configured payment and order policy.
- **Postcondition:** An accepted order is linked to the student, stall, items, and pickup slot.

## 6.2 UC-02 — Staff Manages an Order

- **Primary actor:** Canteen staff.
- **Precondition:** Staff is authenticated and assigned to the relevant stall.
- **Main flow:** View incoming orders, open an order, verify details, update status, prepare items, mark ready, and confirm handover.
- **Alternative flow:** Reject an unauthorized update or invalid status transition.
- **Postcondition:** Order status and relevant timestamps are stored.

## 6.3 UC-03 — Staff Views Demand Forecasts

- **Primary actor:** Canteen staff.
- **Precondition:** Staff is authorized to view forecasts for the assigned stall.
- **Main flow:** Select a date or forecast period, request predictions, view estimated demand by item, and use estimates for preparation planning.
- **Alternative flow:** If data is insufficient or the model is unavailable, show a baseline estimate or clear unavailability message.
- **Postcondition:** Forecasts are displayed with period and generation details.

## 6.4 UC-04 — Student Receives Recommendations

- **Primary actor:** Student.
- **Precondition:** Menu data is available.
- **Main flow:** Open the home page or menu, view recommended items, select an item, inspect details, and add it to the cart.
- **Alternative flow:** If there is no order history, show popular or otherwise eligible items.
- **Postcondition:** The student can continue checkout with an available item.

## 6.5 UC-05 — Administrator Manages Stalls and Users

- **Primary actor:** Administrator.
- **Precondition:** Administrator has a valid privileged account.
- **Main flow:** Open administration interface, inspect records, add or update stalls, manage account status or role assignments, and review reports.
- **Alternative flow:** Reject invalid data or actions outside administrator permissions.
- **Postcondition:** Authorized changes are persisted and relevant actions are logged where applicable.

# 7. External Interface Requirements

## 7.1 User Interface

The application shall provide:

- Home page showing available stalls and relevant recommendations.
- Student login and registration pages.
- Stall listing and menu pages.
- Cart and checkout pages.
- Order confirmation, tracking, and history pages.
- Staff dashboard for menu and order management.
- Administrator dashboard for configuration and reporting.

## 7.2 Software Interfaces

| Component | Interface requirement |
|---|---|
| Next.js | Renders web UI and handles application routes and server-side operations |
| Prisma ORM | Provides typed database access and migration management |
| PostgreSQL | Stores persistent application and transaction data |
| ML service | Accepts permitted input data and returns forecasts or recommendations |
| Authentication | Validates credentials or sessions and enforces access policies |
| Payment provider | Optional integration for real digital payments, subject to provider APIs and configuration |
| Location service | Optional browser geolocation or other approved mechanism for campus eligibility |

## 7.3 Hardware Interfaces

No specialized hardware is required for the basic system. Students and staff may access it using standard computers or smartphones with a supported browser.

## 7.4 Communication Interfaces

- Browser and application server communicate using HTTP over HTTPS in production.
- Application server communicates with PostgreSQL through a secured database connection.
- External ML, payment, or notification services use documented interfaces when implemented.

# 8. Database and Data Requirements

The following logical data model matches the core project entities. It is conceptual and should be reconciled with the actual Prisma schema.

| Entity | Important data | Purpose |
|---|---|---|
| `student` | ID, name, email, password hash, role/status as applicable | User identity and access |
| `stall` | ID, name, description, operating status | Stall information |
| `menu_item` | ID, stall ID, name, price, preparation time, availability | Menu management |
| `pickup_slot` | ID, stall ID, start/end time, capacity | Pickup scheduling |
| `orders` | ID, student ID, stall ID, slot ID, total, status, timestamps | Order lifecycle |
| `order_item` | ID, order ID, menu item ID, quantity, purchase-time price | Order line items |
| `payment` (optional) | Method, status, amount, transaction reference | Payment tracking |
| `order_status_history` (optional) | Status transition, timestamp, responsible actor | Audit trail |
| `forecast_result` (optional) | Item, period, predicted quantity, model version, generated time | Forecast records |
| `recommendation_event` (optional) | Recommendation impressions, selections, interactions | Recommendation evaluation |

## 8.1 Data Validation Requirements

1. Account identifiers such as email must follow configured uniqueness rules.
2. Menu prices and quantities must be valid; quantities must be positive.
3. Each order item must reference a valid order and menu item.
4. Each order must reference a valid student, stall, and required pickup slot.
5. Purchase-time prices must be preserved in historical order records.
6. Slot capacity must be checked safely during concurrent order placement.
7. Deletion and deactivation policies must preserve required transaction history.
8. Database migrations must be repeatable and version-controlled.

## 8.2 Data Collection for Machine Learning

**Demand forecasting:** Collect order timestamp, pickup date/time, item identifier, quantity ordered, stall identifier, order status, and historical availability where possible. Cancelled or rejected orders must be handled consistently.

**Recommendations:** Collect only data required by the selected method, such as item popularity, completed-order counts, permitted student-item interactions, and order-history or co-occurrence data when personalization is introduced.

> Synthetic data may be used to demonstrate the pipeline, but evaluation results must identify it as synthetic. Synthetic-data performance must not be represented as real-world accuracy.

# 9. Acceptance Criteria and System Testing

The following tests translate major requirements into observable outcomes. Performance and concurrency tests must define their environment and workload.

| Test ID | Scenario | Expected result |
|---|---|---|
| TC-01 | Register using valid information | Account is created successfully |
| TC-02 | Register using an identifier already in use | Duplicate registration is rejected |
| TC-03 | Student attempts to access staff dashboard | Access is denied |
| TC-04 | Add an available menu item to cart | Item and valid quantity appear in cart |
| TC-05 | Attempt to purchase unavailable item | Checkout is blocked or item must be removed |
| TC-06 | Place a valid order | One consistent order with correct items and total is stored |
| TC-07 | Attempt to exceed slot capacity | Excess booking is rejected |
| TC-08 | Two users reserve the final slot simultaneously | Configured capacity is not exceeded |
| TC-09 | Staff performs valid status transition | New status is persisted and displayed |
| TC-10 | Staff updates another stall's order | Unauthorized update is rejected |
| TC-11 | New student opens recommendations | Eligible popular or fallback items are shown |
| TC-12 | Recommended item becomes unavailable | System prevents adding it to cart |
| TC-13 | Forecasting has insufficient data | Baseline is shown or insufficiency is indicated |
| TC-14 | ML service fails temporarily | Core ordering remains usable with appropriate fallback |
| TC-15 | Different student opens private order history | Private records remain inaccessible |
| TC-16 | Run database backup and restore test | Data is recoverable according to documented procedure |
| TC-17 | Access app on mobile and desktop | Core workflows remain usable at both sizes |
| TC-18 | Run defined performance workload | Response times are measured against targets |

# 10. Assumptions, Dependencies, and Limitations

## 10.1 Assumptions

- Students and staff have a supported browser and network connection.
- Staff maintain accurate menu and availability information.
- Order history accumulates after the application begins operating.
- Staff update order status as preparation progresses.
- Pickup slots follow a configurable capacity policy.
- Administrators manage authorized user and stall records.

## 10.2 Dependencies

- A functioning PostgreSQL database and valid connection configuration.
- Correct Prisma schema and migrations.
- A configured authentication mechanism.
- A suitable application hosting environment.
- A Python environment or equivalent ML runtime if ML is implemented in Python.
- External payment, email, push-notification, or location services if selected.

## 10.3 Limitations

- Forecast quality may initially be limited by a lack of historical order data.
- Personalized recommendations may be unreliable for new students or items without interaction history.
- Browser geolocation does not guarantee that a user is physically inside campus.
- Payment processing is not production-ready without a verified payment integration.
- Forecasts support planning but cannot guarantee actual demand.

# 11. Requirements Traceability Matrix

| Project objective | Related requirements | Verification |
|---|---|---|
| Secure access | FR-01–FR-09; NFR-06–NFR-15 | Authentication and authorization tests |
| Digital food ordering | FR-10–FR-37 | Menu, cart, and order tests |
| Reduce pickup congestion | FR-38–FR-46 | Slot capacity and concurrency tests |
| Reliable payments | FR-47–FR-52 | Payment-state and transaction tests |
| Simplify staff operations | FR-53–FR-59 | Staff workflow tests |
| Enable administration | FR-60–FR-65 | Role and administrative tests |
| Predict food demand | FR-66–FR-74 | Forecast validation and MAE evaluation |
| Recommend menu items | FR-75–FR-82 | Recommendation and fallback tests |
| Restrict campus ordering | FR-83–FR-86 | Location-policy tests if implemented |
| Data-driven decisions | FR-87–FR-92 | Reporting and data-consistency tests |

# 12. Future Enhancements

1. Integration with PES University identity systems.
2. Real payment gateway integration and automated refunds.
3. Push notifications, SMS, or email notifications.
4. Advanced demand forecasting using calendar events, weather, and other relevant features.
5. Personalized recommendations using collaborative filtering or hybrid methods.
6. Ingredient inventory tracking and automatic replenishment suggestions.
7. Automated preparation-time estimation and staff workload optimization.
8. Advanced analytics dashboards and model monitoring.

# 13. Conclusion

The proposed PES University Canteen Automation System combines web-based ordering, pickup-slot scheduling, staff and administrator management, and machine-learning-assisted operations in a single platform.

This SRS defines the expected application behavior, quality requirements, and criteria for evaluating implementation. The two ML components—food demand forecasting and food recommendations—are designed to use order data collected by the application, with fallback strategies until sufficient historical data becomes available.

---

## Submission Note

Treat this document as the proposed requirements baseline. Before submitting it as the final SRS, verify that each feature described as implemented actually exists in the application. Distinguish implemented functionality from planned geo-fencing, payment integration, notifications, and ML capabilities.
