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

from google.appengine.ext import webapp
from google.appengine.api import users
from google.appengine.ext.webapp.util import run_wsgi_app

import simplejson

class GetUserInfo(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'

        user = users.get_current_user()
        if user is None:
            self.response.out.write(simplejson.dumps({'login': users.create_login_url("/")}))
        else:
            isadmin = users.is_current_user_admin()
            self.response.out.write(simplejson.dumps({'user': user.email(), 'isadmin': isadmin}))

application = webapp.WSGIApplication([('/public/v1/myinfo', GetUserInfo)])

if __name__ == "__main__":
    run_wsgi_app(application)
