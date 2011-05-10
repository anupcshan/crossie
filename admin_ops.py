#!/usr/bin/python

from google.appengine.api import memcache
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

import simplejson

class FlushMemcache(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'
        try:
            memcache.flush_all()
            self.response.out.write(simplejson.dumps({'success': 1}))
        except:
            self.response.out.write(simplejson.dumps({'error': 'Could not clear memcache.'}))

application = webapp.WSGIApplication([('/admin/v1/clearmemcache', FlushMemcache)])

if __name__ == "__main__":
    run_wsgi_app(application)
