#!/usr/bin/python

from google.appengine.api import memcache
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

from crossie_app import *
import simplejson
import datetime

class FlushMemcache(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'
        try:
            memcache.flush_all()
            self.response.out.write(simplejson.dumps({'success': 1}))
        except:
            self.response.out.write(simplejson.dumps({'error': 'Could not clear memcache.'}))

class CheckDB(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'

        ucsnotincd = []
        cdsnotinuc = []
        for usercrossie in UserCrossie.all():
            if usercrossie.user not in usercrossie.crossiedata.acl:
                ucsnotincd.append({'user': usercrossie.user.email(), 'crossienum': usercrossie.crossienum, 'usercrossie': usercrossie.key().id()})

        for crossiedata in CrossieData.all():
            for usr in crossiedata.acl:
                uc = UserCrossie.all().filter('user', usr).filter('crossienum', crossiedata.crossienum).get().crossiedata.key().id()
                if uc != crossiedata.key().id():
                    cdsnotinuc.append({'user': usr.email(), 'crossienum': crossiedata.crossienum, 'crossiedata': uc, 'addressable': crossiedata.key().id()})

        self.response.out.write(simplejson.dumps({'ucsnotincd': ucsnotincd, 'cdsnotinuc': cdsnotinuc}))

class FetchTodaysCrossie(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'
        today = datetime.datetime.now() + datetime.timedelta(minutes=330)
        year = today.year
        month = today.month
        day = today.day
        metadata = fetchpage(year, month, day)
        self.response.out.write(metadata)

application = webapp.WSGIApplication([('/admin/v1/clearmemcache', FlushMemcache), ('/admin/v1/checkdb', CheckDB),
                                      ('/admin/v1/fetchtodayscrossie', FetchTodaysCrossie)])

if __name__ == "__main__":
    run_wsgi_app(application)
