"""ML modules for the PES University Canteen Automation System.

Two jobs, both batch and offline (ADR 0006):

* ``forecast``  — daily demand per menu item (SRS §3.9) → ``forecast_result``
* ``recommend`` — ranked menu items per student (SRS §3.10) → ``recommendation_result``

Each run is evaluated against a documented baseline and recorded in ``model_run``.
The web app only reads these tables, so ordering never waits on ML.
"""
