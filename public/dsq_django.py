"""Django inside the browser.

A real Django (models, ORM, URLs, views, templates) runs in your page with an in-memory SQLite database.
A real project is created with `django-admin startproject` and `manage.py startapp`; here this helper does the same set-up for you:

    from dsq_django import setup, create_tables, serve
    setup()                        # settings + apps, like settings.py
    ...define models (Meta: app_label = 'shop') ...
    create_tables(Product)         # like `manage.py migrate`
    client = serve(urlpatterns)    # like `manage.py runserver`, but as a test client
"""
import sys
import types


def setup():
    import os
    os.environ['DJANGO_ALLOW_ASYNC_UNSAFE'] = 'true'   # the browser runs Python inside an event loop; there is no other thread
    import django
    from django.conf import settings
    if settings.configured:
        return
    app = types.ModuleType('shop')
    app.__path__ = ['/home/pyodide']
    sys.modules['shop'] = app
    settings.configure(
        DEBUG=False, SECRET_KEY='dsquest', ALLOWED_HOSTS=['*'], INSTALLED_APPS=['shop'], ROOT_URLCONF='dsq_urls', USE_TZ=True,
        DEFAULT_AUTO_FIELD='django.db.models.BigAutoField',
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
        TEMPLATES=[{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': False, 'OPTIONS': {}}],
    )
    django.setup()


def create_tables(*models):
    """Create (or recreate) the tables for these models, like `makemigrations` + `migrate`."""
    from django.db import connection
    for m in models:
        with connection.schema_editor() as ed:
            try:
                ed.delete_model(m)
            except Exception:
                pass
        with connection.schema_editor() as ed:
            ed.create_model(m)


def serve(urlpatterns):
    """Use these URL patterns and return a client that can GET/POST them, like a browser."""
    from django.urls import clear_url_caches
    from django.test import Client
    mod = types.ModuleType('dsq_urls')
    mod.urlpatterns = urlpatterns
    sys.modules['dsq_urls'] = mod
    clear_url_caches()
    return Client(raise_request_exception=False)
