#!/usr/bin/python

# Online Crossie - A web application to solve the Hindu crossword.
#
# Copyright (C) 2011 Anup C Shan
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

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
        
class FetchLoggedInUsers(webapp.RequestHandler):
    def get(self):
        for token in UserToken.all().filter('created <=', datetime.datetime.now() - datetime.timedelta(hours=2)):
            token.delete()

        userlist = []
        for token in UserToken.all().filter('created >', datetime.datetime.now() - datetime.timedelta(hours=2)):
            userlist.append(token.user.email())

        self.response.out.write(simplejson.dumps({'loggedInUsers': userlist}))

application = webapp.WSGIApplication([('/admin/v1/clearmemcache', FlushMemcache), ('/admin/v1/checkdb', CheckDB),
                                      ('/admin/v1/fetchtodayscrossie', FetchTodaysCrossie),
                                      ('/admin/v1/fetchloggedinusers', FetchLoggedInUsers)])

if __name__ == "__main__":
    run_wsgi_app(application)
