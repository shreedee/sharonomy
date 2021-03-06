﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using OpenChain.Client;
using System.Net.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;


// For more information on enabling Web API for empty projects, visit http://go.microsoft.com/fwlink/?LinkID=397860

namespace web.Controllers
{
    [Route("api/[controller]")]
    public class CommunityController : Controller
    {
        const String _siteCreatorURL = @"http://localhost:9085";
        const String _ocURLBase = @"http://localhost:8090/";
        internal const string UNKNOWN_COMMUNITY = "unknown_community";


        const string communityadmin = "educate mutual festival portion card pink divide same cart soon pony wasp";
        //address is XvQqwAHFK1yDYpcf88kmV8S2mWLSC3mLGA

        private Models.CommunityContext _dbContext;
        public CommunityController(Models.CommunityContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Community information by handle
        /// </summary>
        /// <param name="handle"></param>
        /// <returns></returns>
        [HttpGet("handle/{handle}")]
        public Models.Community Gethandle(String handle)
        {
            return _dbContext.Communities.Single(c => c.handle == handle);
        }

        /// <summary>
        /// Search for community
        /// </summary>
        /// <param name="pattern"></param>
        /// <returns></returns>
        [HttpGet("{pattern}")]
        public IEnumerable<Models.Community> Get(String pattern)
        {
            var ret = _dbContext.Communities
                .Where(u => 
                    (u.handle.Contains(pattern) || u.full_name.Contains(pattern)
                    )
                ).Distinct().Take(10).ToArray();

            return ret.Where(c=>c.handle != UNKNOWN_COMMUNITY).ToArray();
        }

        static internal async Task SetAdminACL(OpenChainSession ad, String CommunityHandle, String adminPubKey)
        {
            //set asset ACL
            await setACL(ad, getTreasuryPath(CommunityHandle), new[] { new {
                        subjects = new [] { new {
                            addresses = new[] {adminPubKey },
                            required =1 }
                        },
                        permissions = new {account_negative="Permit",account_modify="Permit"}
            } });

            //set user ACL
            await setACL(ad, USERFOLDER, new[] {
                        new {
                            subjects = new [] { new {
                                addresses = new String[]  {adminPubKey },
                                required =1 }
                            },
                            permissions = (object)new {account_create="Permit",account_modify="Permit",account_spend="Permit"}
                        },
                        new {
                            subjects = new [] { new {
                                addresses = new String[] { },
                                required =0 }
                            },
                            permissions = (object) new {account_modify="Permit"}
                        },

            });

        }

        internal const String USERFOLDER = "/aka/";

        static internal String getUserPath(String userHandle)
        {
            return $"{USERFOLDER}{userHandle}/";
        }

        static internal String getTreasuryPath(String communityHandle)
        {
            return $"/treasury/{communityHandle}_hours/";
        }

        static async Task updateLedgerInfo(OpenChainSession ad, Models.OCCommunityInfo community)
        {
            var ir = await ad.GetData<LedgerInfo>("/", "info");
            ir.Value = new LedgerInfo { Name = community.full_name, TermsOfService = community.description };
            await ad.SetData(ir);

        }

        /// <summary>
        /// Updates community information
        /// </summary>
        /// <param name="community"></param>
        /// <returns></returns>
        [HttpPost]
        [Authorize]
        public async Task<Models.Community> Post( [FromBody]Models.Community community)
        {
            User.EnsureCommunityAdmin(community.handle);

            using (var transaction = _dbContext.Database.BeginTransaction())
            {
                var orgOCUrl = _dbContext.Communities.AsNoTracking().Single(c => c.handle == community.handle).OCUrl;


                var attached = _dbContext.Communities.Attach(community);
                attached.State = EntityState.Modified;
                attached.Property(c => c.OCUrl).IsModified = false;


               await  _dbContext.SaveChangesAsync();

                var ocs = new OpenChainServer(orgOCUrl);
                using (var ad = ocs.Login(TokenController.OCAdminpassPhrase))
                {
                    await updateLedgerInfo(ad,community);
                }

                transaction.Commit();
                return community;
            }

        }


        /// <summary>
        /// Adds a new Community
        /// </summary>
        /// <param name="handle"></param>
        /// <param name="req"></param>
        /// <returns></returns>
        [HttpPut("{handle}")]
        [Converters.UniqueViolation("PK_Communities", "handle", "This community handle is already taken")]
        [Authorize]
        public async Task<Models.Community> Put(String handle, [FromBody]Models.UpdateCommunityReq req)
        {
            using (var transaction = _dbContext.Database.BeginTransaction())
            using (var cli = new HttpClient())
            {
                if (handle == UNKNOWN_COMMUNITY)
                    throw new Converters.DisplayableException("invalid handle");

                //fix the admin user detail
                var userHandle = this.User.Identity.Name;
                var adminUser = _dbContext.Users.Single(u =>
                            u.communityHandle == CommunityController.UNKNOWN_COMMUNITY
                            && u.handle == userHandle);
                adminUser.address = $"{handle}_admin";

                var newCommunity = new Models.Community
                {
                    handle = handle,
                    OCUrl = $"{_ocURLBase}{handle}/",
                    description = req.description,
                    full_name = req.full_name
                };

                _dbContext.Communities.Add(newCommunity);
                await _dbContext.SaveChangesAsync();

                var query = $"{_siteCreatorURL}?site={handle}";
                var tresult = await cli.GetAsync(query);

                if (tresult.StatusCode != System.Net.HttpStatusCode.OK)
                {
                    throw new Converters.DisplayableException("Site creation error");
                }

                var s = await tresult.Content.ReadAsStringAsync();

                var ocs = new OpenChainServer(newCommunity.OCUrl);
                using (var ad = ocs.Login(TokenController.OCAdminpassPhrase))
                {
                    await updateLedgerInfo(ad, req);

                    //create the asset defination
                    var assetPath = $"/treasury/{handle}_hours/";

                    

                    var assetDef = await ad.GetData<Models.AssetDefination>(getTreasuryPath(handle), "asdef");
                    assetDef.Value = new Models.AssetDefination { name = $"Hour exchange of {req.full_name}" };
                    await ad.SetData(assetDef);

                    var assetsToCreate = new[] { $"/asset/{handle}_hours/", $"/{handle}_login/" };

                    //create the assets
                    var accs = await Task.WhenAll(assetsToCreate.Select(async a =>
                    {
                        var record = await ad.Api.GetValue(getTreasuryPath(handle), "ACC", a);
                        return new AccountRecord(record).GetRecord();
                    }).ToArray());
                    
                    var mutation = ad.Api.BuildMutation(Openchain.ByteString.Empty, accs);
                    await ad.PostMutation(mutation);

                    await SetAdminACL(ad, handle, req.adminPubKey);

                }
                transaction.Commit();
                return newCommunity;
            }

            

        }

        static internal async Task setACL<T>(OpenChainSession ad, String assetPath, T acl) where T:class
        {
            var assetACL = await ad.GetData<T>(assetPath, "acl");
            assetACL.Value = acl;
            await ad.SetData(assetACL);

        }

        
    }
}
